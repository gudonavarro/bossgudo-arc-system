import { defineEventHandler } from "h3";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { createAuthRouter } = require(resolve(process.cwd(), "server/utils/auth-router.js")) as {
  createAuthRouter: () => (
    request: unknown,
    response: unknown,
    next: (error?: unknown) => void,
  ) => unknown;
};
const express = require("express") as {
  json: (options: { limit: string }) => (
    request: unknown,
    response: unknown,
    next: (error?: unknown) => unknown,
  ) => unknown;
};

type CookieSameSite = "lax" | "strict" | "none";

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite;
  maxAge?: number;
}

const router = createAuthRouter();
const jsonParser = express.json({ limit: "10kb" });

export default defineEventHandler((event) => {
  const request = event.node.req;
  const response = event.node.res;
  const nodeResponse = response as typeof response & {
    set?: (field: string, value: string) => typeof response;
    status?: (code: number) => typeof response;
    json?: (body: unknown) => void;
    cookie?: (name: string, value: string, options?: CookieOptions) => void;
    clearCookie?: (name: string, options?: CookieOptions) => void;
  };

  nodeResponse.set = (field: string, value: string) => {
    response.setHeader(field, value);
    return response;
  };
  nodeResponse.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  nodeResponse.json = (body: unknown) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(body));
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
    response.setHeader("Set-Cookie", parts.join("; "));
  };
  nodeResponse.clearCookie = (name: string) => {
    response.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly`);
  };

  request.url = (request.url ?? "/").replace(/^\/api\/auth/, "") || "/";
  return new Promise<void>((resolvePromise, rejectPromise) => {
    jsonParser(request, response, (parseError) => {
      if (parseError) {
        rejectPromise(parseError);
        return;
      }

      Promise.resolve(
        router(request, response, (routerError: unknown) => {
          if (routerError) {
            rejectPromise(routerError);
            return;
          }
          resolvePromise();
        }),
      ).then(() => resolvePromise()).catch(rejectPromise);
    });
  });
});
