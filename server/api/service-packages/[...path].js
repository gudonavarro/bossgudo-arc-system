import { defineEventHandler, setResponseStatus } from "h3";
import express from "express";
import { getServicePackageModel } from "../../models/service-package.js";
import { connectMongoose } from "../../utils/mongoose";
import { createServicePackageRouter } from "../../utils/service-package-router.js";

const router = createServicePackageRouter();
const app = express();
app.disable("x-powered-by");
app.use(router);

export default defineEventHandler(async (event) => {
  let packageModels;
  try {
    const connection = await connectMongoose(useRuntimeConfig(event));
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
    packageModels,
    get(name) {
      const value = event.node.req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
  });
  const routerUrl = (request.url ?? "/").replace(/^\/api\/service-packages/, "");
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
