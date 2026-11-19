import express from "express";
import { createRequire } from "node:module";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
} from "../models/service-booking.js";
import {
  OBJECT_ID_PATTERN,
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
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAdminListFilter(query) {
  const filter = {};
  const enumFilters = [
    ["bookingStatus", BOOKING_STATUSES, "Invalid booking status."],
    ["paymentStatus", PAYMENT_STATUSES, "Invalid payment status."],
    ["serviceType", SERVICE_TYPES, "Invalid service type."],
  ];
  for (const [field, allowed, message] of enumFilters) {
    if (query[field] === undefined) continue;
    if (!allowed.includes(query[field])) return { error: message };
    filter[field] = query[field];
  }

  if (query.customerId !== undefined) {
    if (typeof query.customerId !== "string" || !OBJECT_ID_PATTERN.test(query.customerId)) {
      return { error: "Invalid customer id." };
    }
    filter.customer_id = query.customerId;
  }

  const serviceDate = {};
  for (const [param, operator] of [["dateFrom", "$gte"], ["dateTo", "$lte"]]) {
    if (query[param] === undefined) continue;
    const date = parseCalendarDate(query[param]);
    if (!date) return { error: `${param} must be a valid YYYY-MM-DD date.` };
    serviceDate[operator] = date;
  }
  if (serviceDate.$gte && serviceDate.$lte && serviceDate.$gte > serviceDate.$lte) {
    return { error: "dateFrom must not be after dateTo." };
  }
  if (Object.keys(serviceDate).length > 0) filter.serviceDate = serviceDate;

  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.trim().length > MAX_SEARCH_LENGTH) {
      return { error: `Search must be at most ${MAX_SEARCH_LENGTH} characters.` };
    }
    const search = query.search.trim();
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [
        { reference: pattern },
        { customerName: pattern },
        { customerEmail: pattern },
        { customerPhone: pattern },
      ];
    }
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

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { buildAdminListFilter, createAdminServiceBookingRouter };
