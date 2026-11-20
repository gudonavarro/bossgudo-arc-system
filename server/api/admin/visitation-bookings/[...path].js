import { defineEventHandler, getRequestIP, setResponseStatus } from "h3";
import express from "express";
import { getSessionModel } from "../../../models/session";
import { getUserModel } from "../../../models/user";
import { getVisitationBookingModel } from "../../../models/visitation-booking";
import { createAuthCollections } from "../../../utils/auth-collections";
import { connectMongoose } from "../../../utils/mongoose";
import { createAdminVisitationBookingRouter } from "../../../utils/admin-visitation-booking-router.js";

const router = createAdminVisitationBookingRouter();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
app.use(router);

export default defineEventHandler(async (event) => {
  let authCollections;
  let visitationModels;
  try {
    const connection = await connectMongoose(useRuntimeConfig(event));
    authCollections = createAuthCollections(
      getUserModel(connection),
      getSessionModel(connection),
    );
    visitationModels = {
      VisitationBooking: getVisitationBookingModel(connection),
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Visitation booking database unavailable:", errorName);
    setResponseStatus(event, 503);
    return { error: "Visitation bookings are temporarily unavailable." };
  }

  const request = Object.assign(event.node.req, {
    authCollections,
    visitationModels,
    ip: getRequestIP(event) ?? "unknown",
    get(name) {
      const value = event.node.req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
  });
  const routerUrl = (request.url ?? "/").replace(
    /^\/api\/admin\/visitation-bookings/,
    "",
  );
  request.url = routerUrl.startsWith("/") ? routerUrl : `/${routerUrl}`;
  return new Promise((resolve, reject) => {
    app(request, event.node.res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
