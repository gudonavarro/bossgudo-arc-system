import express from "express";
import { createRequire } from "node:module";
import { depositFor, fromCents, parseAmountInput } from "./money.js";
import { PAYMENT_METHODS, PAYMENT_TARGETS } from "../models/payment.js";
import {
  CUSTOM_POND_PRICING,
  calculateCustomPondCents,
  findActivePackage,
} from "./service-catalog.js";
import { BOOKING_STATUSES } from "../models/service-booking.js";
import {
  HttpError,
  bookingCents,
  bookingIdentifierFilter,
  handleRouteError,
  isDuplicateKeyError,
  paginationMeta,
  parseFutureServiceDate,
  parsePagination,
  saveWithUniqueReference,
  serializeBooking,
  serializePayment,
  withTransaction,
} from "./service-booking.js";

const require = createRequire(import.meta.url);
const path = require("node:path");
const serverUtilsPath = (fileName) =>
  path.resolve(process.cwd(), "server", "utils", fileName);
const { createAuthenticationMiddleware } = require(
  serverUtilsPath("authenticate.js"),
);

const ACTIVE_BOOKING_STATUSES = ["Pending", "Approved", "Confirmed", "Ongoing"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateText(value, { field, required, maxLength }) {
  if (value === undefined || value === null || value === "") {
    return required ? { error: `${field} is required.` } : { value: "" };
  }
  if (typeof value !== "string") {
    return { error: `${field} must be text.` };
  }
  const text = value.trim();
  if (required && !text) {
    return { error: `${field} is required.` };
  }
  if (text.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters.` };
  }
  return { value: text };
}

function validateDimension(value, label) {
  const { minDimensionMetres: min, maxDimensionMetres: max } =
    CUSTOM_POND_PRICING;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-9
  ) {
    return {
      error: `${label} must be between ${min} and ${max} metres with at most two decimals.`,
    };
  }
  return { value };
}

function validateCustomConfiguration(configuration) {
  if (!isPlainObject(configuration)) {
    return { error: "Provide the custom pond configuration." };
  }
  const { minLayers, maxLayers } = CUSTOM_POND_PRICING;
  const { layers, filtration } = configuration;
  if (!Number.isInteger(layers) || layers < minLayers || layers > maxLayers) {
    return { error: `Layers must be between ${minLayers} and ${maxLayers}.` };
  }
  const width = validateDimension(configuration.width, "Width");
  if (width.error) return width;
  const length = validateDimension(configuration.length, "Length");
  if (length.error) return length;
  if (typeof filtration !== "boolean") {
    return { error: "Filtration must be true or false." };
  }
  return {
    value: {
      layers,
      width: width.value,
      length: length.value,
      area: Math.round(width.value * length.value * 10_000) / 10_000,
      filtration,
    },
  };
}

/**
 * Validates the booking request and prices it from the server catalog.
 * Client-supplied prices, totals, statuses, and customer details are ignored.
 */
function validateServiceBookingInput(body) {
  if (!isPlainObject(body)) {
    return { error: "Provide service booking details." };
  }

  const serviceDate = parseFutureServiceDate(body.serviceDate);
  if (serviceDate.error) return serviceDate;
  const serviceLocation = validateText(body.serviceLocation, {
    field: "Service location",
    required: true,
    maxLength: 300,
  });
  if (serviceLocation.error) return serviceLocation;
  const notes = validateText(body.notes, {
    field: "Notes",
    required: false,
    maxLength: 1000,
  });
  if (notes.error) return notes;

  let pricing;
  if (body.serviceType === "Pond Package") {
    const servicePackage =
      typeof body.packageId === "string"
        ? findActivePackage(body.packageId)
        : null;
    if (!servicePackage) {
      return { error: "Select an available service package." };
    }
    pricing = {
      packageNameSnapshot: servicePackage.name,
      packagePriceCents: servicePackage.priceCents,
      customizationFeeCents: 0,
      customConfiguration: null,
    };
  } else if (body.serviceType === "Custom Pond Design") {
    const configuration = validateCustomConfiguration(body.customConfiguration);
    if (configuration.error) return configuration;
    pricing = {
      packageNameSnapshot: CUSTOM_POND_PRICING.name,
      packagePriceCents: 0,
      customizationFeeCents: calculateCustomPondCents(configuration.value),
      customConfiguration: configuration.value,
    };
  } else {
    return { error: "Select a valid service type." };
  }

  return {
    value: {
      serviceType: body.serviceType,
      serviceDate: serviceDate.value,
      serviceLocation: serviceLocation.value,
      notes: notes.value,
      ...pricing,
    },
  };
}

const UNSAFE_METADATA_PATTERN = /[\u0000-\u001f\u007f]/;

function validatePaymentInput(body) {
  if (!isPlainObject(body)) {
    return { error: "Provide payment details." };
  }
  if (!PAYMENT_TARGETS.includes(body.paymentTarget)) {
    return { error: "Payment target must be deposit or balance." };
  }
  if (!PAYMENT_METHODS.includes(body.method)) {
    return { error: "Select a supported payment method." };
  }
  const amount = parseAmountInput(body.amount);
  if (amount.error) {
    return {
      error: "Amount must be a positive value with at most two decimals.",
    };
  }

  const gcashReference = validateText(body.gcashReference, {
    field: "GCash reference",
    required: body.method === "GCash",
    maxLength: 64,
  });
  if (gcashReference.error) return gcashReference;
  if (gcashReference.value && !/^[A-Za-z0-9-]+$/.test(gcashReference.value)) {
    return { error: "GCash reference may contain only letters, digits, and dashes." };
  }

  const receiptFileName = validateText(body.receiptFileName, {
    field: "Receipt file name",
    required: true,
    maxLength: 255,
  });
  if (receiptFileName.error) return receiptFileName;
  if (
    /[\\/]/.test(receiptFileName.value) ||
    UNSAFE_METADATA_PATTERN.test(receiptFileName.value)
  ) {
    return { error: "Receipt file name is invalid." };
  }

  const receiptStorageKey = validateText(body.receiptStorageKey, {
    field: "Receipt storage key",
    required: true,
    maxLength: 512,
  });
  if (receiptStorageKey.error) return receiptStorageKey;
  if (/\s/.test(receiptStorageKey.value)) {
    return { error: "Receipt storage key is invalid." };
  }

  return {
    value: {
      paymentTarget: body.paymentTarget,
      method: body.method,
      amountCents: amount.value,
      gcashReference: gcashReference.value || undefined,
      receiptFileName: receiptFileName.value,
      receiptStorageKey: receiptStorageKey.value,
    },
  };
}

/**
 * Determines how much is due for the requested payment target and rejects
 * submissions the booking is not eligible for. Amounts come from the stored
 * booking, never from the client.
 */
function expectedPaymentCents(booking, { paymentTarget, amountCents }) {
  if (booking.bookingStatus === "Pending") {
    throw new HttpError(409, "Payments open once the booking is approved.");
  }
  if (["Rejected", "Cancelled"].includes(booking.bookingStatus)) {
    throw new HttpError(409, "This booking can no longer accept payments.");
  }
  if (booking.paymentStatus === "Verification Pending") {
    throw new HttpError(409, "A payment for this booking is already awaiting verification.");
  }

  const { deposit, paid, balance } = bookingCents(booking);
  if (balance <= 0) {
    throw new HttpError(409, "This booking is already fully paid.");
  }

  let expected;
  if (paymentTarget === "deposit") {
    if (paid >= deposit) {
      throw new HttpError(409, "The initial deposit has already been paid.");
    }
    if (booking.bookingStatus !== "Approved") {
      throw new HttpError(409, "The deposit can only be paid for an approved booking.");
    }
    expected = deposit - paid;
    if (amountCents < expected) {
      throw new HttpError(400, "Amount is less than the required deposit.");
    }
  } else {
    if (paid < deposit) {
      throw new HttpError(409, "Pay the initial deposit before the balance.");
    }
    expected = balance;
  }

  if (amountCents > balance) {
    throw new HttpError(400, "Amount exceeds the outstanding balance.");
  }
  return expected;
}

function createServiceBookingRouter() {
  const router = express.Router();
  const authenticateCustomer = createAuthenticationMiddleware({
    requiredRole: "customer",
  });

  router.use(authenticateCustomer);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.post("/", async (request, response) => {
    const validation = validateServiceBookingInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { ServiceBooking } = request.bookingModels;
    const { authUser } = request;
    const input = validation.value;
    try {
      const duplicate = await ServiceBooking.exists({
        customer_id: authUser.id,
        serviceDate: input.serviceDate,
        packageNameSnapshot: input.packageNameSnapshot,
        bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
      });
      if (duplicate) {
        throw new HttpError(
          409,
          "You already have an active booking for this service on this date.",
        );
      }

      const totalCents = input.packagePriceCents + input.customizationFeeCents;
      const now = new Date();
      const booking = await saveWithUniqueReference(
        (reference) =>
          new ServiceBooking({
            customer_id: authUser.id,
            reference,
            serviceType: input.serviceType,
            packageNameSnapshot: input.packageNameSnapshot,
            packagePrice: fromCents(input.packagePriceCents),
            serviceDate: input.serviceDate,
            serviceLocation: input.serviceLocation,
            customerName: `${authUser.firstName} ${authUser.lastName}`.trim(),
            customerEmail: authUser.email,
            customerPhone: authUser.phoneNumber,
            notes: input.notes,
            customConfiguration: input.customConfiguration,
            customizationFee: fromCents(input.customizationFeeCents),
            deliveryFee: fromCents(0),
            totalAmount: fromCents(totalCents),
            depositAmount: fromCents(depositFor(totalCents)),
            paidAmount: fromCents(0),
            balanceAmount: fromCents(totalCents),
            bookingStatus: "Pending",
            paymentStatus: "Unpaid",
            statusHistory: [
              {
                status: "Pending",
                changedBy: authUser.id,
                changedAt: now,
                note: "Booking submitted by customer.",
              },
            ],
          }),
      );
      return response.status(201).json({ booking: serializeBooking(booking) });
    } catch (error) {
      return handleRouteError(response, error, "Service booking creation");
    }
  });

  router.get("/", async (request, response) => {
    const pagination = parsePagination(request.query);
    if (pagination.error) {
      return response.status(400).json({ error: pagination.error });
    }
    const filter = { customer_id: request.authUser.id };
    const { bookingStatus } = request.query;
    if (bookingStatus !== undefined) {
      if (!BOOKING_STATUSES.includes(bookingStatus)) {
        return response.status(400).json({ error: "Invalid booking status." });
      }
      filter.bookingStatus = bookingStatus;
    }

    const { ServiceBooking } = request.bookingModels;
    const { skip, limit } = pagination.value;
    try {
      const [bookings, total] = await Promise.all([
        ServiceBooking.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ServiceBooking.countDocuments(filter),
      ]);
      return response.status(200).json({
        bookings: bookings.map(serializeBooking),
        pagination: paginationMeta(pagination.value, total),
      });
    } catch (error) {
      return handleRouteError(response, error, "Service booking list");
    }
  });

  router.get("/:identifier", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }

    const { ServiceBooking, Payment } = request.bookingModels;
    try {
      // Ownership is part of the query so other customers' bookings are
      // indistinguishable from missing ones.
      const booking = await ServiceBooking.findOne({
        ...identifierFilter,
        customer_id: request.authUser.id,
      }).lean();
      if (!booking) {
        return response.status(404).json({ error: "Booking not found." });
      }
      const payments = await Payment.find({ service_booking_id: booking._id })
        .sort({ submittedAt: -1, _id: -1 })
        .lean();
      return response.status(200).json({
        booking: serializeBooking(booking),
        payments: payments.map((payment) => serializePayment(payment)),
      });
    } catch (error) {
      return handleRouteError(response, error, "Service booking lookup");
    }
  });

  router.post("/:identifier/payments", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }
    const validation = validatePaymentInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { connection, ServiceBooking, Payment } = request.bookingModels;
    const input = validation.value;
    try {
      const result = await withTransaction(connection, async (session) => {
        const booking = await ServiceBooking.findOne({
          ...identifierFilter,
          customer_id: request.authUser.id,
        }).session(session);
        if (!booking) {
          throw new HttpError(404, "Booking not found.");
        }
        const expectedCents = expectedPaymentCents(booking, input);

        if (input.gcashReference) {
          const referenceUsed = await Payment.exists({
            gcashReference: input.gcashReference,
            status: { $in: ["Pending", "Verified"] },
          }).session(session);
          if (referenceUsed) {
            throw new HttpError(
              409,
              "This GCash reference has already been submitted.",
            );
          }
        }

        const payment = await new Payment({
          service_booking_id: booking._id,
          paymentTarget: input.paymentTarget,
          amount: fromCents(input.amountCents),
          expectedAmount: fromCents(expectedCents),
          method: input.method,
          gcashReference: input.gcashReference,
          receiptFileName: input.receiptFileName,
          receiptStorageKey: input.receiptStorageKey,
          status: "Pending",
          submittedAt: new Date(),
        }).save({ session });

        // A submitted receipt only marks the booking as awaiting manual
        // verification; paid and balance amounts change on verification.
        booking.paymentStatus = "Verification Pending";
        try {
          await booking.save({ session });
        } catch (error) {
          if (!session) {
            await Payment.deleteOne({ _id: payment._id, status: "Pending" });
          }
          throw error;
        }
        return { booking, payment };
      });

      return response.status(201).json({
        payment: serializePayment(result.payment),
        booking: serializeBooking(result.booking),
      });
    } catch (error) {
      if (isDuplicateKeyError(error, "service_booking_id")) {
        return response.status(409).json({
          error: "A payment for this booking is already awaiting verification.",
        });
      }
      return handleRouteError(response, error, "Payment submission");
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { createServiceBookingRouter, validateServiceBookingInput };
