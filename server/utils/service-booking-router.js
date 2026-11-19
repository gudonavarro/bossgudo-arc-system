import express from "express";
import { createRequire } from "node:module";
import { depositFor, fromCents } from "./money.js";
import {
  CUSTOM_POND_PRICING,
  calculateCustomPondCents,
  findActivePackage,
} from "./service-catalog.js";
import { BOOKING_STATUSES } from "../models/service-booking.js";
import {
  HttpError,
  handleRouteError,
  paginationMeta,
  parseFutureServiceDate,
  parsePagination,
  saveWithUniqueReference,
  serializeBooking,
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

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { createServiceBookingRouter, validateServiceBookingInput };
