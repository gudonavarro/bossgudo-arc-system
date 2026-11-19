import express from "express";
import { createRequire } from "node:module";
import {
  VISITATION_STATUSES,
  VISIT_TYPES,
} from "../models/visitation-booking";
import {
  HttpError,
  bookingIdentifierFilter,
  handleRouteError,
  isDateClosed,
  isWeekendDate,
  paginationMeta,
  parseFutureServiceDate,
  parsePagination,
  saveWithUniqueReference,
  validateCustomerContact,
} from "./service-booking.js";

const require = createRequire(import.meta.url);
const path = require("node:path");
const serverUtilsPath = (fileName) =>
  path.resolve(process.cwd(), "server", "utils", fileName);
const { createAuthenticationMiddleware } = require(
  serverUtilsPath("authenticate.js"),
);

const ACTIVE_VISIT_STATUSES = ["Booked", "Pending Review", "Approved"];
const MAX_REASON_LENGTH = 500;
const MAX_FARM_NAME_LENGTH = 120;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalText(value, label, maxLength) {
  if (value === undefined || value === null) return { value: "" };
  if (typeof value !== "string") return { error: `${label} must be text.` };
  const text = value.trim();
  if (text.length > maxLength) {
    return { error: `${label} must be at most ${maxLength} characters.` };
  }
  return { value: text };
}

/**
 * Validates a visitation request. Regular visits use the weekend schedule;
 * special requests are for dates outside it and need a reason.
 */
function validateVisitationInput(body, authUser) {
  if (!isPlainObject(body)) {
    return { error: "Provide visitation details." };
  }
  if (!VISIT_TYPES.includes(body.visitType)) {
    return { error: "Visit type must be Regular or Special." };
  }
  const visitDate = parseFutureServiceDate(body.visitDate, { label: "Visit date" });
  if (visitDate.error) return visitDate;
  if (body.visitType === "Regular" && !isWeekendDate(visitDate.value)) {
    return {
      error: "Regular visits are on Saturdays and Sundays. Request a special date instead.",
    };
  }

  const reason = readOptionalText(
    body.specialRequestReason,
    "Reason",
    MAX_REASON_LENGTH,
  );
  if (reason.error) return reason;
  if (body.visitType === "Special" && !reason.value) {
    return { error: "Tell us why you need a special date." };
  }

  if (
    !Number.isInteger(body.visitorCount) ||
    body.visitorCount < 1 ||
    body.visitorCount > 5
  ) {
    return { error: "Number of visitors must be between 1 and 5." };
  }
  const farmName = readOptionalText(body.farmName, "Farm name", MAX_FARM_NAME_LENGTH);
  if (farmName.error) return farmName;
  const contact = validateCustomerContact(body, authUser, { emailRequired: true });
  if (contact.error) return contact;

  return {
    value: {
      visitType: body.visitType,
      visitDate: visitDate.value,
      specialRequestReason:
        body.visitType === "Special" ? reason.value : undefined,
      visitorCount: body.visitorCount,
      farmName: farmName.value,
      ...contact.value,
    },
  };
}

/**
 * Shapes a visitation for API responses. Without `includeAudit`, the ids of
 * the staff who reviewed or changed it are omitted (customer responses).
 */
function serializeVisitation(document, { includeAudit = false } = {}) {
  const visit =
    typeof document?.toObject === "function" ? document.toObject() : document;
  const serialized = {
    _id: visit._id,
    reference: visit.reference,
    customer_id: visit.customer_id,
    visitDate: visit.visitDate,
    visitType: visit.visitType,
    specialRequestReason: visit.specialRequestReason ?? null,
    visitorCount: visit.visitorCount,
    farmName: visit.farmName ?? "",
    customerName: visit.customerName,
    customerEmail: visit.customerEmail,
    customerPhone: visit.customerPhone,
    status: visit.status,
    reviewedAt: visit.reviewedAt ?? null,
    statusHistory: (visit.statusHistory ?? []).map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      note: entry.note,
      ...(includeAudit ? { changedBy: entry.changedBy ?? null } : {}),
    })),
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  };
  if (includeAudit) serialized.reviewedBy = visit.reviewedBy ?? null;
  return serialized;
}

function createVisitationBookingRouter() {
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
    const { authUser } = request;
    const validation = validateVisitationInput(request.body, authUser);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { VisitationBooking, AvailableDate } = request.visitationModels;
    const input = validation.value;
    try {
      const closed = await isDateClosed(AvailableDate, "visit", input.visitDate);
      if (input.visitType === "Regular" && closed) {
        throw new HttpError(
          409,
          "That date has been closed. Please choose another date.",
        );
      }
      if (
        input.visitType === "Special" &&
        isWeekendDate(input.visitDate) &&
        !closed
      ) {
        throw new HttpError(
          400,
          "That date is on the regular schedule. Pick it from the weekend calendar instead.",
        );
      }

      const duplicate = await VisitationBooking.exists({
        customer_id: authUser.id,
        visitDate: input.visitDate,
        status: { $in: ACTIVE_VISIT_STATUSES },
      });
      if (duplicate) {
        throw new HttpError(409, "You already have a visit booked on this date.");
      }

      const status = input.visitType === "Special" ? "Pending Review" : "Booked";
      const visit = await saveWithUniqueReference(
        (reference) =>
          new VisitationBooking({
            ...input,
            customer_id: authUser.id,
            reference,
            status,
            statusHistory: [
              {
                status,
                changedBy: authUser.id,
                changedAt: new Date(),
                note:
                  status === "Booked"
                    ? "Visitation booked by customer."
                    : "Special date requested by customer.",
              },
            ],
          }),
        "VS",
      );
      return response.status(201).json({ visit: serializeVisitation(visit) });
    } catch (error) {
      return handleRouteError(response, error, "Visitation booking creation");
    }
  });

  router.get("/", async (request, response) => {
    const pagination = parsePagination(request.query);
    if (pagination.error) {
      return response.status(400).json({ error: pagination.error });
    }
    const filter = { customer_id: request.authUser.id };
    const { status } = request.query;
    if (status !== undefined) {
      if (!VISITATION_STATUSES.includes(status)) {
        return response.status(400).json({ error: "Invalid visitation status." });
      }
      filter.status = status;
    }

    const { VisitationBooking } = request.visitationModels;
    const { skip, limit } = pagination.value;
    try {
      const [visits, total] = await Promise.all([
        VisitationBooking.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        VisitationBooking.countDocuments(filter),
      ]);
      return response.status(200).json({
        visits: visits.map(serializeVisitation),
        pagination: paginationMeta(pagination.value, total),
      });
    } catch (error) {
      return handleRouteError(response, error, "Visitation booking list");
    }
  });

  router.get("/:identifier", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier, "VS");
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid visitation id or reference." });
    }

    const { VisitationBooking } = request.visitationModels;
    try {
      const visit = await VisitationBooking.findOne({
        ...identifierFilter,
        customer_id: request.authUser.id,
      }).lean();
      if (!visit) {
        return response.status(404).json({ error: "Visitation not found." });
      }
      return response.status(200).json({ visit: serializeVisitation(visit) });
    } catch (error) {
      return handleRouteError(response, error, "Visitation booking lookup");
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export {
  createVisitationBookingRouter,
  serializeVisitation,
  validateVisitationInput,
};
