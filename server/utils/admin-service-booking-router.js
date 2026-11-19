import express from "express";
import { createRequire } from "node:module";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
} from "../models/service-booking.js";
import {
  OBJECT_ID_PATTERN,
  bookingIdentifierFilter,
  handleRouteError,
  paginationMeta,
  parsePagination,
  serializeBooking,
  serializePayment,
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
const MAX_SEARCH_LENGTH = 100;

function parseCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function escapeRegExp(text) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

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
          ...serializeBooking(booking),
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
        booking: serializeBooking(booking),
        payments: payments.map((payment) =>
          serializePayment(payment, { includeAudit: true }),
        ),
      });
    } catch (error) {
      return handleRouteError(response, error, "Admin service booking lookup");
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { buildAdminListFilter, createAdminServiceBookingRouter };
