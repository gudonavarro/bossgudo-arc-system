import { defineEventHandler, getRequestIP, setResponseStatus } from "h3";
import express from "express";
import { getSessionModel } from "../../../models/session";
import { getUserModel } from "../../../models/user";
import { getServicePackageModel } from "../../../models/service-package.js";
import { createAuthCollections } from "../../../utils/auth-collections";
import { connectMongoose } from "../../../utils/mongoose";
import { createAdminServicePackageRouter } from "../../../utils/admin-service-package-router.js";

const router = createAdminServicePackageRouter();
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
  let packageModels;
  try {
    const connection = await connectMongoose(useRuntimeConfig(event));
    authCollections = createAuthCollections(
      getUserModel(connection),
      getSessionModel(connection),
    );
    packageModels = {
      connection,
      ServicePackage: getServicePackageModel(connection),
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Package catalog database unavailable:", errorName);
    setResponseStatus(event, 503);
    return { error: "The package catalog is temporarily unavailable." };
  }

  const request = Object.assign(event.node.req, {
    authCollections,
    packageModels,
    ip: getRequestIP(event) ?? "unknown",
    get(name) {
      const value = event.node.req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
  });
  const routerUrl = (request.url ?? "/").replace(/^\/api\/admin\/service-packages/, "");
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
