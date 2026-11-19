import crypto from "node:crypto";
import { decimalToNumber, toCents } from "./money.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const BOOKING_REFERENCE_PATTERN = /^SB-\d{8}-[A-Z2-9]{6}$/;
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERENCE_ATTEMPTS = 5;
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 50;
const BUSINESS_TIME_ZONE = "Asia/Manila";
const UNAVAILABLE_MESSAGE = "Service bookings are temporarily unavailable.";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function getErrorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

function isDuplicateKeyError(error, field) {
  return (
    error?.code === 11000 &&
    (!field || Object.hasOwn(error.keyPattern ?? {}, field))
  );
}

/** Maps known failures to safe responses without leaking internals. */
function handleRouteError(response, error, context) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message });
  }
  const errorName = getErrorName(error);
  if (errorName === "ValidationError" || errorName === "CastError") {
    return response.status(400).json({ error: "Invalid booking details." });
  }
  if (errorName === "VersionError") {
    return response.status(409).json({
      error: "This booking was updated by another request. Please retry.",
    });
  }
  if (isDuplicateKeyError(error)) {
    return response.status(409).json({
      error: "This request conflicts with an existing record.",
    });
  }
  console.error(`${context} request failed:`, errorName);
  return response.status(503).json({ error: UNAVAILABLE_MESSAGE });
}

function isTransactionUnsupported(error) {
  return (
    error?.code === 20 ||
    /Transaction numbers are only allowed/i.test(error?.message ?? "")
  );
}

/**
 * Runs `work(session)` inside a MongoDB transaction. When the deployment
 * does not support transactions (standalone server), `work(null)` runs
 * without one; callers keep that path safe with atomic conditional updates,
 * optimistic concurrency, and compensation.
 */
async function withTransaction(connection, work) {
  let session;
  try {
    session = await connection.startSession();
  } catch (error) {
    if (isTransactionUnsupported(error)) return work(null);
    throw error;
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) return work(null);
    throw error;
  } finally {
    await session.endSession();
  }
}

function bookingIdentifierFilter(identifier) {
  if (typeof identifier !== "string") return null;
  if (OBJECT_ID_PATTERN.test(identifier)) return { _id: identifier };
  const reference = identifier.trim().toUpperCase();
  return BOOKING_REFERENCE_PATTERN.test(reference) ? { reference } : null;
}

function generateBookingReference(now = new Date()) {
  const datePart = formatBusinessDate(now).replaceAll("-", "");
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return `SB-${datePart}-${suffix}`;
}

/** Saves a new booking, retrying when a generated reference collides. */
async function saveWithUniqueReference(createBooking) {
  for (let attempt = 1; ; attempt += 1) {
    const booking = createBooking(generateBookingReference());
    try {
      return await booking.save();
    } catch (error) {
      if (!isDuplicateKeyError(error, "reference") || attempt >= REFERENCE_ATTEMPTS) {
        throw error;
      }
    }
  }
}

function formatBusinessDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Parses a calendar date (YYYY-MM-DD) that must fall after today in the
 * farm's time zone. Stored as UTC midnight of that calendar day.
 */
function parseFutureServiceDate(value, now = new Date()) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: "Service date must use the YYYY-MM-DD format." };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { error: "Service date is not a valid calendar date." };
  }
  if (value <= formatBusinessDate(now)) {
    return { error: "Service date must be a future date." };
  }
  return { value: date };
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit =
    query.limit === undefined ? DEFAULT_PAGE_LIMIT : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) {
    return { error: "Page must be a positive whole number." };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    return { error: `Limit must be between 1 and ${MAX_PAGE_LIMIT}.` };
  }
  return { value: { page, limit, skip: (page - 1) * limit } };
}

function paginationMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Payment status implied by verified amounts alone. */
function derivePaymentStatus(paidCents, totalCents) {
  if (paidCents <= 0) return "Unpaid";
  return paidCents >= totalCents ? "Paid" : "Partially Paid";
}

function toPlain(document) {
  return typeof document?.toObject === "function"
    ? document.toObject({ depopulate: false })
    : document;
}

/**
 * Shapes a booking for API responses. Without `includeAudit`, the
 * administrator ids behind status and delivery fee changes are omitted.
 */
function serializeBooking(document, { includeAudit = false } = {}) {
  const booking = toPlain(document);
  const statusHistory = (booking.statusHistory ?? []).map((entry) =>
    includeAudit
      ? entry
      : { status: entry.status, changedAt: entry.changedAt, note: entry.note },
  );
  const serialized = {
    _id: booking._id,
    reference: booking.reference,
    customer_id: booking.customer_id,
    serviceType: booking.serviceType,
    packageNameSnapshot: booking.packageNameSnapshot,
    packagePrice: decimalToNumber(booking.packagePrice),
    serviceDate: booking.serviceDate,
    serviceLocation: booking.serviceLocation,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    customConfiguration: booking.customConfiguration ?? null,
    customizationFee: decimalToNumber(booking.customizationFee),
    deliveryFee: decimalToNumber(booking.deliveryFee),
    totalAmount: decimalToNumber(booking.totalAmount),
    depositAmount: decimalToNumber(booking.depositAmount),
    paidAmount: decimalToNumber(booking.paidAmount),
    balanceAmount: decimalToNumber(booking.balanceAmount),
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    deliveryFeeSetAt: booking.deliveryFeeSetAt ?? null,
    statusHistory,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
  if (includeAudit) {
    serialized.deliveryFeeSetBy = booking.deliveryFeeSetBy ?? null;
  }
  return serialized;
}

function serializePayment(document, { includeAudit = false } = {}) {
  const payment = toPlain(document);
  const serialized = {
    _id: payment._id,
    service_booking_id: payment.service_booking_id,
    paymentTarget: payment.paymentTarget,
    amount: decimalToNumber(payment.amount),
    expectedAmount: decimalToNumber(payment.expectedAmount),
    method: payment.method,
    gcashReference: payment.gcashReference ?? null,
    receiptFileName: payment.receiptFileName,
    receiptStorageKey: payment.receiptStorageKey,
    status: payment.status,
    submittedAt: payment.submittedAt,
    verifiedAt: payment.verifiedAt ?? null,
    rejectionReason: payment.rejectionReason ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
  if (includeAudit) {
    serialized.verifiedBy = payment.verifiedBy ?? null;
  }
  return serialized;
}

function bookingCents(booking) {
  return {
    packagePrice: toCents(booking.packagePrice),
    customizationFee: toCents(booking.customizationFee),
    deliveryFee: toCents(booking.deliveryFee),
    total: toCents(booking.totalAmount),
    deposit: toCents(booking.depositAmount),
    paid: toCents(booking.paidAmount),
    balance: toCents(booking.balanceAmount),
  };
}

export {
  HttpError,
  OBJECT_ID_PATTERN,
  bookingCents,
  bookingIdentifierFilter,
  derivePaymentStatus,
  getErrorName,
  handleRouteError,
  isDuplicateKeyError,
  paginationMeta,
  parseFutureServiceDate,
  parsePagination,
  saveWithUniqueReference,
  serializeBooking,
  serializePayment,
  withTransaction,
};
