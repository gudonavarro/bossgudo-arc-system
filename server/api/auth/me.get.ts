import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  defineEventHandler,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
} from "h3";
import { getSessionModel } from "../../models/session";
import { getUserModel } from "../../models/user";
import { createAuthCollections } from "../../utils/auth-collections";
import { connectMongoose } from "../../utils/mongoose";

const require = createRequire(import.meta.url);

interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: "customer" | "admin";
}

interface AuthRequest {
  headers: NodeJS.Dict<string | string[]>;
  authCollections: ReturnType<typeof createAuthCollections>;
  authUser?: AuthUser;
}

interface AuthResponse {
  statusCode: number;
  body?: unknown;
  status(code: number): AuthResponse;
  json(body: unknown): AuthResponse;
}

type Authenticate = (
  request: AuthRequest,
  response: AuthResponse,
  next: () => void,
) => Promise<unknown>;

const { createAuthenticationMiddleware } = require(
  resolve(process.cwd(), "server/utils/authenticate.js"),
) as {
  createAuthenticationMiddleware: () => Authenticate;
};

interface AuthMeHandlerOptions {
  connect?: typeof connectMongoose;
  getRuntimeConfig?: (event: H3Event) => ReturnType<typeof useRuntimeConfig>;
  getCollections?: (
    connection: Awaited<ReturnType<typeof connectMongoose>>,
  ) => ReturnType<typeof createAuthCollections>;
  authenticate?: Authenticate;
}

export function createAuthMeHandler({
  connect = connectMongoose,
  getRuntimeConfig = (event) => useRuntimeConfig(event),
  getCollections = (connection) =>
    createAuthCollections(
      getUserModel(connection),
      getSessionModel(connection),
    ),
  authenticate = createAuthenticationMiddleware(),
}: AuthMeHandlerOptions = {}) {
  return defineEventHandler(async (event) => {
    setResponseHeader(event, "Cache-Control", "no-store");

    let authCollections: ReturnType<typeof createAuthCollections>;
    try {
      const connection = await connect(getRuntimeConfig(event));
      authCollections = getCollections(connection);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Authentication database unavailable:", errorName);
      setResponseStatus(event, 503);
      return { error: "Authentication is temporarily unavailable." };
    }

    const request: AuthRequest = {
      headers: event.node.req.headers,
      authCollections,
    };
    const response: AuthResponse = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await authenticate(request, response, () => undefined);
    if (response.statusCode !== 200) {
      setResponseStatus(event, response.statusCode);
    }
    return response.body ?? { user: request.authUser ?? null };
  });
}

export default createAuthMeHandler();
