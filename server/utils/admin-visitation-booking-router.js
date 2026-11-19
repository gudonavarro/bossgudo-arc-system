import express from "express";
import { createRequire } from "node:module";
import {
  VISITATION_STATUSES,
  VISIT_TYPES,
} from "../models/visitation-booking";
import {
  HttpError,
  OBJECT_ID_PATTERN,
  bookingIdentifierFilter,
  escapeRegExp,
  handleRouteError,
  paginationMeta,
  parseCalendarDate,
  parsePagination,
} from "./service-booking.js";
import { serializeVisitation } from "./visitation-booking-router.js";

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

/**
 * Administrator visitation transitions, matching the dashboard workflow:
 * special-date requests are approved or declined; booked or approved visits
 * are completed or cancelled.
 */
const VISITATION_TRANSITIONS = Object.freeze({
  Approved: ["Pending Review"],
  Declined: ["Pending Review"],
  Completed: ["Booked", "Approved"],
  Cancelled: ["Booked", "Approved"],
});
const REVIEW_STATUSES = new Set(["Approved", "Declined"]);

function buildVisitationListFilter(query) {
  const filter = {};
  if (query.status !== undefined) {
    if (!VISITATION_STATUSES.includes(query.status)) {
      return { error: "Invalid visitation status." };
    }
    filter.status = query.status;
  }
  if (query.visitType !== undefined) {
    if (!VISIT_TYPES.includes(query.visitType)) {
      return { error: "Invalid visit type." };
    }
    filter.visitType = query.visitType;
  }
  if (query.customerId !== undefined) {
    if (typeof query.customerId !== "string" || !OBJECT_ID_PATTERN.test(query.customerId)) {
      return { error: "Invalid customer id." };
    }
    filter.customer_id = query.customerId;
  }

  const visitDate = {};
  for (const [param, operator] of [["dateFrom", "$gte"], ["dateTo", "$lte"]]) {
    if (query[param] === undefined) continue;
    const date = parseCalendarDate(query[param]);
    if (!date) return { error: `${param} must be a valid YYYY-MM-DD date.` };
    visitDate[operator] = date;
  }
  if (visitDate.$gte && visitDate.$lte && visitDate.$gte > visitDate.$lte) {
    return { error: "dateFrom must not be after dateTo." };
  }
  if (Object.keys(visitDate).length > 0) filter.visitDate = visitDate;

  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.trim().length > MAX_SEARCH_LENGTH) {
      return { error: `Search must be at most ${MAX_SEARCH_LENGTH} characters.` };
    }
    const text = query.search.trim();
    if (text) {
      const pattern = new RegExp(escapeRegExp(text), "i");
      filter.$or = [
        { reference: pattern },
        { customerName: pattern },
        { customerEmail: pattern },
        { customerPhone: pattern },
        { farmName: pattern },
      ];
    }
  }
  return { value: filter };
}

function validateStatusInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide the new visitation status." };
  }
  if (!Object.hasOwn(VISITATION_TRANSITIONS, body.status)) {
    return { error: "Status must be Approved, Declined, Completed, or Cancelled." };
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

function createAdminVisitationBookingRouter() {
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
    const filter = buildVisitationListFilter(request.query);
    if (filter.error) {
      return response.status(400).json({ error: filter.error });
    }

    const { VisitationBooking } = request.visitationModels;
    const { skip, limit } = pagination.value;
    try {
      const [visits, total] = await Promise.all([
        VisitationBooking.find(filter.value)
          .sort({ visitDate: 1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .populate("customer_id", CUSTOMER_FIELDS)
          .populate("reviewedBy", STAFF_FIELDS)
          .lean(),
        VisitationBooking.countDocuments(filter.value),
      ]);
      return response.status(200).json({
        visits: visits.map((visit) => serializeVisitation(visit, AUDIT_VIEW)),
        pagination: paginationMeta(pagination.value, total),
      });
    } catch (error) {
      return handleRouteError(response, error, "Admin visitation list");
    }
  });

  router.get("/:identifier", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier, "VS");
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid visitation id or reference." });
    }

    const { VisitationBooking } = request.visitationModels;
    try {
      const visit = await VisitationBooking.findOne(identifierFilter)
        .populate("customer_id", CUSTOMER_FIELDS)
        .populate("reviewedBy", STAFF_FIELDS)
        .populate("statusHistory.changedBy", STAFF_FIELDS)
        .lean();
      if (!visit) {
        return response.status(404).json({ error: "Visitation not found." });
      }
      return response.status(200).json({ visit: serializeVisitation(visit, AUDIT_VIEW) });
    } catch (error) {
      return handleRouteError(response, error, "Admin visitation lookup");
    }
  });

  router.patch("/:identifier/status", async (request, response) => {
    const identifierFilter = bookingIdentifierFilter(request.params.identifier, "VS");
    if (!identifierFilter) {
      return response.status(400).json({ error: "Invalid visitation id or reference." });
    }
    const validation = validateStatusInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    const { VisitationBooking } = request.visitationModels;
    const { status, note } = validation.value;
    const allowedFrom = VISITATION_TRANSITIONS[status];
    const adminId = request.authUser.id;
    const now = new Date();
    try {
      // The status condition makes the transition atomic: a concurrent or
      // repeated request cannot apply a change from a stale status.
      const update = {
        $set: {
          status,
          ...(REVIEW_STATUSES.has(status) ? { reviewedBy: adminId, reviewedAt: now } : {}),
        },
        $push: {
          statusHistory: {
            status,
            changedBy: adminId,
            changedAt: now,
            ...(note ? { note } : {}),
          },
        },
      };
      const visit = await VisitationBooking.findOneAndUpdate(
        { ...identifierFilter, status: { $in: allowedFrom } },
        update,
        { returnDocument: "after", runValidators: true },
      )
        .populate("customer_id", CUSTOMER_FIELDS)
        .populate("reviewedBy", STAFF_FIELDS)
        .lean();
      if (!visit) {
        const existing = await VisitationBooking.findOne(identifierFilter)
          .select("status")
          .lean();
        if (!existing) throw new HttpError(404, "Visitation not found.");
        throw new HttpError(
          409,
          `A ${existing.status} visitation cannot be changed to ${status}.`,
        );
      }
      return response.status(200).json({ visit: serializeVisitation(visit, AUDIT_VIEW) });
    } catch (error) {
      return handleRouteError(response, error, "Visitation status update");
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { buildVisitationListFilter, createAdminVisitationBookingRouter };
