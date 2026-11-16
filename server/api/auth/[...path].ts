import { defineEventHandler, getRequestIP, setResponseStatus } from "h3";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { ServerResponse } from "node:http";
import { getSessionModel } from "../../models/session";
import { getUserModel } from "../../models/user";
import { createAuthCollections } from "../../utils/auth-collections";
import { connectMongoose } from "../../utils/mongoose";

const require = createRequire(import.meta.url);
type ExpressMiddleware = (
  request: unknown,
  response: unknown,
  next: (error?: unknown) => void,
) => unknown;

interface ExpressApplication {
  (request: unknown, response: unknown, next: (error?: unknown) => void): unknown;
  disable(name: string): ExpressApplication;
  get(name: string): unknown;
  use(...handlers: ExpressMiddleware[]): ExpressApplication;
}

interface ExpressFactory {
  (): ExpressApplication;
  json: (options: { limit: string }) => ExpressMiddleware;
}

const { createAuthRouter } = require(resolve(process.cwd(), "server/utils/auth-router.js")) as {
  createAuthRouter: () => ExpressMiddleware;
};
const express = require("express") as ExpressFactory;

type CookieSameSite = "lax" | "strict" | "none";

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite;
  maxAge?: number;
}

const router = createAuthRouter();
const app = express();
const jsonParser = express.json({ limit: "10kb" });
app.disable("x-powered-by");
app.use((_request, response, next) => {
  const nodeResponse = response as ServerResponse & {
    cookie?: (name: string, value: string, options?: CookieOptions) => void;
    clearCookie?: (name: string, options?: CookieOptions) => void;
  };
  nodeResponse.cookie = (
    name: string,
    value: string,
    options: CookieOptions = {},
  ) => {
    const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (typeof options.maxAge === "number") {
      parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    }
    nodeResponse.setHeader("Set-Cookie", parts.join("; "));
  };
  nodeResponse.clearCookie = (name: string, options: CookieOptions = {}) => {
    const parts = [`${name}=`, "Path=/"];
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    parts.push("Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    nodeResponse.setHeader("Set-Cookie", parts.join("; "));
  };
  next();
});
app.use(jsonParser);
app.use(router);

export default defineEventHandler(async (event) => {
  let authCollections;
  try {
    const connection = await connectMongoose(useRuntimeConfig(event));
    authCollections = createAuthCollections(
      getUserModel(connection),
      getSessionModel(connection),
    );
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Authentication database unavailable:", errorName);
    setResponseStatus(event, 503);
    return { error: "Authentication is temporarily unavailable." };
  }

  const runtimeConfig = useRuntimeConfig(event);
  const request = Object.assign(event.node.req, {
    authCollections,
    emailConfig: {
      smtpHost: runtimeConfig.smtpHost,
      smtpPort: runtimeConfig.smtpPort,
      smtpUser: runtimeConfig.smtpUser,
      smtpPass: runtimeConfig.smtpPass,
      smtpFrom: runtimeConfig.smtpFrom,
      passwordResetSecret: runtimeConfig.passwordResetSecret,
    },
    app,
    ip: getRequestIP(event) ?? "unknown",
    get(name: string) {
      const value = event.node.req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
  });
  request.url = (request.url ?? "/").replace(/^\/api\/auth/, "") || "/";
  return new Promise<void>((resolvePromise, rejectPromise) => {
    app(request, event.node.res, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
});
