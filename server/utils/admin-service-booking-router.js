import express from "express";
import { createRequire } from "node:module";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
} from "../models/service-booking.js";
import { pipeline } from "node:stream/promises";
import { depositFor, fromCents, parseAmountInput, toCents } from "./money.js";
import {
  RECEIPT_CONTENT_TYPES,
  findReceiptFile,
  openReceiptDownload,
} from "./receipt-storage.js";
import {
  HttpError,
  OBJECT_ID_PATTERN,
  bookingCents,
  bookingIdentifierFilter,
  derivePaymentStatus,
  escapeRegExp,
  handleRouteError,
  paginationMeta,
  parseCalendarDate,
  parsePagination,
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

const CUSTOMER_FIELDS = "firstName lastName email phoneNumber isActive";
const STAFF_FIELDS = "firstName lastName role";
const AUDIT_VIEW = Object.freeze({ includeAudit: true });
const MAX_SEARCH_LENGTH = 100;

const ENUM_FILTERS = [
  ["bookingStatus", BOOKING_STATUSES, "Invalid booking status."],
  ["paymentStatus", PAYMENT_STATUSES, "Invalid payment status."],
  ["serviceType", SERVICE_TYPES, "Invalid service type."],
];

function parseEnumFilters(query) {
  const filter = {};
  for (const [field, allowed, message] of ENUM_FILTERS) {
    if (query[field] === undefined) continue;
    if (!allowed.includes(query[field])) return { error: message };
    filter[field] = query[field];
  }
  return { value: filter };
}

function parseCustomerFilter({ customerId }) {
  if (customerId === undefined) return { value: {} };
  if (typeof customerId !== "string" || !OBJECT_ID_PATTERN.test(customerId)) {
    return { error: "Invalid customer id." };
  }
  return { value: { customer_id: customerId } };
}

function parseServiceDateFilter(query) {
  const range = {};
  for (const [param, operator] of [["dateFrom", "$gte"], ["dateTo", "$lte"]]) {
    if (query[param] === undefined) continue;
    const date = parseCalendarDate(query[param]);
    if (!date) return { error: `${param} must be a valid YYYY-MM-DD date.` };
    range[operator] = date;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    return { error: "dateFrom must not be after dateTo." };
  }
  return { value: Object.keys(range).length > 0 ? { serviceDate: range } : {} };
}

function parseSearchFilter({ search }) {
  if (search === undefined) return { value: {} };
  if (typeof search !== "string" || search.trim().length > MAX_SEARCH_LENGTH) {
    return { error: `Search must be at most ${MAX_SEARCH_LENGTH} characters.` };
  }
  const text = search.trim();
  if (!text) return { value: {} };
  const pattern = new RegExp(escapeRegExp(text), "i");
  return {
    value: {
      $or: [
        { reference: pattern },
        { customerName: pattern },
        { customerEmail: pattern },
        { customerPhone: pattern },
      ],
    },
  };
}

function buildAdminListFilter(query) {
  const filter = {};
  for (const parse of [
    parseEnumFilters,
    parseCustomerFilter,
    parseServiceDateFilter,
    parseSearchFilter,
  ]) {
    const result = parse(query);
    if (result.error) return result;
    Object.assign(filter, result.value);
  }
  return { value: filter };
}

async function summarizePayments(Payment, bookingIds) {
  if (bookingIds.length === 0) return new Map();
  const summaries = await Payment.aggregate([
    { $match: { service_booking_id: { $in: bookingIds } } },
    { $sort: { submittedAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$service_booking_id",
        paymentCount: { $sum: 1 },
        pendingPaymentCount: {
          $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
        },
        latestPayment: { $first: "$$ROOT" },
      },
    },
  ]);
  return new Map(
    summaries.map((summary) => [
      String(summary._id),
      {
        paymentCount: summary.paymentCount,
        pendingPaymentCount: summary.pendingPaymentCount,
        latestPayment: serializePayment(summary.latestPayment, {
          includeAudit: true,
        }),
      },
    ]),
  );
}

/**
 * Allowed administrator-driven booking status transitions. "Confirmed" is
 * normally set automatically when the initial deposit is verified; a manual
 * move to "Confirmed" still requires the deposit to be verified.
 */
const BOOKING_STATUS_TRANSITIONS = Object.freeze({
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Confirmed", "Rejected", "Cancelled"],
  Confirmed: ["Ongoing", "Cancelled"],
  Ongoing: ["Completed"],
  Completed: [],
  Rejected: [],
  Cancelled: [],
});
const CLOSING_STATUSES = new Set(["Rejected", "Cancelled"]);

function validateStatusInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide the new booking status." };
  }
  if (!BOOKING_STATUSES.includes(body.status)) {
    return { error: "Invalid booking status." };
  }
  let note = "";
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.trim().length > 500) {
      return { error: "Note must be text of at most 500 characters." };
    }
    note = body.note.trim();
  }
  return { value: { status: body.status, note } };
}

function assertStatusTransition(booking, nextStatus) {
  const allowed = BOOKING_STATUS_TRANSITIONS[booking.bookingStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(
      409,
      `A ${booking.bookingStatus} booking cannot be changed to ${nextStatus}.`,
    );
  }
  if (CLOSING_STATUSES.has(nextStatus) && booking.paymentStatus === "Verification Pending") {
    throw new HttpError(
      409,
      "Review the payment awaiting verification before closing this booking.",
    );
  }
  if (nextStatus === "Confirmed") {
    const { deposit, paid } = bookingCents(booking);
    if (paid < deposit) {
      throw new HttpError(
        409,
        "A booking is confirmed only after its initial deposit is verified.",
      );
    }
  }
}

const DELIVERY_FEE_STATUSES = new Set(["Approved", "Confirmed", "Ongoing", "Completed"]);

/**
 * Recalculates the booking totals for a new delivery fee. The required
 * deposit follows the new total until a payment has been verified; after
 * that the verified deposit stands and the change flows into the balance.
 */
function applyDeliveryFee(booking, deliveryFeeCents) {
  if (!DELIVERY_FEE_STATUSES.has(booking.bookingStatus)) {
    throw new HttpError(
      409,
      `The delivery fee cannot be set on a ${booking.bookingStatus} booking.`,
    );
  }
  if (booking.paymentStatus === "Verification Pending") {
    throw new HttpError(
      409,
      "Review the payment awaiting verification before changing the delivery fee.",
    );
  }

  const cents = bookingCents(booking);
  const total = cents.packagePrice + cents.customizationFee + deliveryFeeCents;
  if (total < cents.paid) {
    throw new HttpError(
      409,
      "The new total would be less than the amount already paid.",
    );
  }

  booking.deliveryFee = fromCents(deliveryFeeCents);
  booking.totalAmount = fromCents(total);
  if (cents.paid === 0) {
    booking.depositAmount = fromCents(depositFor(total));
  }
  booking.balanceAmount = fromCents(total - cents.paid);
  if (cents.paid > 0) {
    booking.paymentStatus = derivePaymentStatus(cents.paid, total);
  }
}

function validateVerificationInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide the verification decision." };
  }
  if (body.decision === "approve") {
    return { value: { decision: "approve" } };
  }
  if (body.decision !== "reject") {
    return { error: "Decision must be approve or reject." };
  }
  const reason =
    typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
  if (!reason || reason.length > 500) {
    return {
      error: "A rejection reason of at most 500 characters is required.",
    };
  }
  return { value: { decision: "reject", rejectionReason: reason } };
}

function assertPaymentApprovable(booking, payment) {
  if (CLOSING_STATUSES.has(booking.bookingStatus)) {
    throw new HttpError(
      409,
      `Payments cannot be approved on a ${booking.bookingStatus} booking.`,
    );
  }
  if (toCents(payment.amount) > bookingCents(booking).balance) {
    throw new HttpError(
      409,
      "This payment exceeds the outstanding balance. Reject it instead.",
    );
  }
}

/**
 * Applies a reviewed payment to its booking. Only verified payments add to
 * the paid amount; a booking becomes Confirmed once its initial deposit is
 * verified, while fulfilment statuses remain under administrator control.
 */
function applyPaymentReview(booking, payment, { decision, adminId, now }) {
  const cents = bookingCents(booking);
  if (decision === "reject") {
    booking.paymentStatus = "Rejected";
    return;
  }

  const paid = cents.paid + toCents(payment.amount);
  booking.paidAmount = fromCents(paid);
  booking.balanceAmount = fromCents(cents.total - paid);
  booking.paymentStatus = derivePaymentStatus(paid, cents.total);
  if (booking.bookingStatus === "Approved" && paid >= cents.deposit) {
    booking.bookingStatus = "Confirmed";
    booking.statusHistory.push({
      status: "Confirmed",
      changedBy: adminId,
      changedAt: now,
      note: "Initial deposit verified.",
    });
  }
}

function createAdminServiceBookingRouter() {
  const router = express.Router();
  const authenticateAdmin = createAuthenticationMiddleware({
    requiredRole: "admin",
  });

  router.use(authenticateAdmin);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (request, response) => {
    const pagination = parsePagination(request.query);
    if (pagination.error) {
      return response.status(400).json({ error: pagination.error });
    }
    const filter = buildAdminListFilter(request.query);
    if (filter.error) {
      return response.status(400).json({ error: filter.error });
    }

    const { ServiceBooking, Payment } = request.bookingModels;
    const { skip, limit } = pagination.value;
    try {
      const [bookings, total] = await Promise.all([
        ServiceBooking.find(filter.value)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate("customer_id", CUSTOMER_FIELDS)
          .lean(),
        ServiceBooking.countDocuments(filter.value),
      ]);
      const paymentSummaries = await summarizePayments(
        Payment,
        bookings.map((booking) => booking._id),
      );
      const emptySummary = {
        paymentCount: 0,
        pendingPaymentCount: 0,
        latestPayment: null,
      };
      return response.status(200).json({
        bookings: bookings.map((booking) => ({
          ...serializeBooking(booking, AUDIT_VIEW),
          payments: paymentSummaries.get(String(booking._id)) ?? emptySummary,
        })),
        pagination: paginationMeta(pagination.value, total),
      });
    } catch (error) {
      return handleRouteError(response, error, "Admin service booking list");
    }
  });

  router.get("/:identifier", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }

    const { ServiceBooking, Payment } = request.bookingModels;
    try {
      const booking = await ServiceBooking.findOne(identifierFilter)
        .populate("customer_id", CUSTOMER_FIELDS)
        .populate("deliveryFeeSetBy", STAFF_FIELDS)
        .populate("statusHistory.changedBy", STAFF_FIELDS)
        .lean();
      if (!booking) {
        return response.status(404).json({ error: "Booking not found." });
      }
      const payments = await Payment.find({ service_booking_id: booking._id })
        .sort({ submittedAt: -1, _id: -1 })
        .populate("verifiedBy", STAFF_FIELDS)
        .lean();
      return response.status(200).json({
        booking: serializeBooking(booking, AUDIT_VIEW),
        payments: payments.map((payment) =>
          serializePayment(payment, { includeAudit: true }),
        ),
      });
    } catch (error) {
      return handleRouteError(response, error, "Admin service booking lookup");
    }
  });

  router.patch("/:identifier/status", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }
    const validation = validateStatusInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { ServiceBooking } = request.bookingModels;
    const { status, note } = validation.value;
    try {
      const booking = await ServiceBooking.findOne(identifierFilter);
      if (!booking) {
        return response.status(404).json({ error: "Booking not found." });
      }
      assertStatusTransition(booking, status);

      booking.bookingStatus = status;
      booking.statusHistory.push({
        status,
        changedBy: request.authUser.id,
        changedAt: new Date(),
        note: note || undefined,
      });
      // Optimistic concurrency rejects the save if the booking changed
      // since it was read (for example, a concurrent payment verification).
      await booking.save();
      return response.status(200).json({ booking: serializeBooking(booking, AUDIT_VIEW) });
    } catch (error) {
      return handleRouteError(response, error, "Booking status update");
    }
  });

  router.patch("/:identifier/delivery-fee", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }
    const deliveryFee = parseAmountInput(request.body?.deliveryFee, {
      allowZero: true,
    });
    if (deliveryFee.error) {
      return response.status(400).json({
        error: "Delivery fee must be zero or a positive value with at most two decimals.",
      });
    }

    const { ServiceBooking } = request.bookingModels;
    try {
      const booking = await ServiceBooking.findOne(identifierFilter);
      if (!booking) {
        return response.status(404).json({ error: "Booking not found." });
      }
      applyDeliveryFee(booking, deliveryFee.value);
      booking.deliveryFeeSetBy = request.authUser.id;
      booking.deliveryFeeSetAt = new Date();
      await booking.save();
      return response.status(200).json({ booking: serializeBooking(booking, AUDIT_VIEW) });
    } catch (error) {
      return handleRouteError(response, error, "Delivery fee update");
    }
  });

  router.patch("/:identifier/payments/:paymentId", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid booking id or reference." });
    }
    if (!OBJECT_ID_PATTERN.test(request.params.paymentId)) {
      return response.status(400).json({ error: "Invalid payment id." });
    }
    const validation = validateVerificationInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { connection, ServiceBooking, Payment } = request.bookingModels;
    const { decision, rejectionReason } = validation.value;
    const adminId = request.authUser.id;
    try {
      const result = await withTransaction(connection, async (session) => {
        const booking = await ServiceBooking.findOne(identifierFilter).session(session);
        if (!booking) {
          throw new HttpError(404, "Booking not found.");
        }
        const pendingPayment = await Payment.findOne({
          _id: request.params.paymentId,
          service_booking_id: booking._id,
        }).session(session);
        if (!pendingPayment) {
          throw new HttpError(404, "Payment not found.");
        }
        if (pendingPayment.status !== "Pending") {
          throw new HttpError(409, "This payment has already been reviewed.");
        }
        if (decision === "approve") {
          assertPaymentApprovable(booking, pendingPayment);
        }

        // Claim the payment atomically: only a still-pending payment can be
        // reviewed, so concurrent or repeated requests cannot verify it twice.
        const now = new Date();
        const payment = await Payment.findOneAndUpdate(
          { _id: pendingPayment._id, status: "Pending" },
          {
            $set: {
              status: decision === "approve" ? "Verified" : "Rejected",
              verifiedBy: adminId,
              verifiedAt: now,
              ...(decision === "reject" ? { rejectionReason } : {}),
            },
          },
          { returnDocument: "after", runValidators: true, session },
        );
        if (!payment) {
          throw new HttpError(409, "This payment has already been reviewed.");
        }

        try {
          applyPaymentReview(booking, payment, { decision, adminId, now });
          await booking.save({ session });
        } catch (error) {
          if (!session) {
            await Payment.updateOne(
              { _id: payment._id, status: payment.status },
              {
                $set: { status: "Pending" },
                $unset: { verifiedBy: 1, verifiedAt: 1, rejectionReason: 1 },
              },
            );
          }
          throw error;
        }
        return { booking, payment };
      });

      return response.status(200).json({
        payment: serializePayment(result.payment, { includeAudit: true }),
        booking: serializeBooking(result.booking, AUDIT_VIEW),
      });
    } catch (error) {
      return handleRouteError(response, error, "Payment verification");
    }
  });

  router.get("/:identifier/payments/:paymentId/receipt", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier);
    if (!identifierFilter || !OBJECT_ID_PATTERN.test(request.params.paymentId)) {
      return response.status(400).json({ error: "Invalid booking or payment id." });
    }

    const { connection, ServiceBooking, Payment } = request.bookingModels;
    try {
      const booking = await ServiceBooking.findOne(identifierFilter).select("_id").lean();
      const payment = booking
        ? await Payment.findOne({
            _id: request.params.paymentId,
            service_booking_id: booking._id,
          })
            .select("receiptStorageKey")
            .lean()
        : null;
      const file = payment
        ? await findReceiptFile(connection, payment.receiptStorageKey)
        : null;
      if (!file) {
        return response.status(404).json({ error: "Receipt not found." });
      }

      const contentType = RECEIPT_CONTENT_TYPES.includes(file.metadata?.contentType)
        ? file.metadata.contentType
        : "application/octet-stream";
      response.set({
        "Content-Type": contentType,
        "Content-Length": String(file.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename || "receipt")}`,
        "X-Content-Type-Options": "nosniff",
      });
      await pipeline(openReceiptDownload(connection, file._id), response);
      return undefined;
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return undefined;
      }
      return handleRouteError(response, error, "Receipt download");
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { buildAdminListFilter, createAdminServiceBookingRouter };
