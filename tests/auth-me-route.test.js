const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createJiti } = require("jiti");
const { createApp, toNodeListener } = require("h3");
const { fetchNodeRequestHandler } = require("node-mock-http");
const {
  SESSION_COOKIE_NAME,
} = require("../server/utils/authenticate");

const jiti = createJiti(__filename);
const { createAuthMeHandler } = jiti("../server/api/auth/me.get.ts");

function createEvent(cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  const responseHeaders = {};
  const response = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
  };
  return {
    event: {
      node: {
        req: { headers },
        res: response,
      },
    },
    response,
    responseHeaders,
  };
}

function createHandler(authCollections, overrides = {}) {
  return createAuthMeHandler({
    connect: async () => "connection",
    getRuntimeConfig: () => ({}),
    getCollections: () => authCollections,
    ...overrides,
  });
}

test("returns a no-store signed-out response through the H3 route", async () => {
  const { event, response, responseHeaders } = createEvent();
  const handler = createHandler({
    sessions: { findOne: async () => null },
    users: { findOne: async () => null },
  });

  const result = await handler(event);

  assert.equal(response.statusCode, 401);
  assert.equal(responseHeaders["cache-control"], "no-store");
  assert.deepEqual(result, { error: "Authentication required." });
});

test("serves internal SSR auth checks through the H3 mock response", async () => {
  const app = createApp();
  app.use(
    "/api/auth/me",
    createAuthMeHandler({
      connect: async () => "connection",
      getRuntimeConfig: () => ({}),
      getCollections: () => ({
        sessions: { findOne: async () => null },
        users: { findOne: async () => null },
      }),
    }),
  );

  const response = await fetchNodeRequestHandler(
    toNodeListener(app),
    "http://localhost/api/auth/me",
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
});

test("returns the authenticated user's minimal identity", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const userId = "0123456789abcdef01234567";
  const expectedTokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const session = {
    _id: "session-1",
    userId,
    tokenHash: expectedTokenHash,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };
  const user = {
    _id: userId,
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    role: "customer",
    isActive: true,
  };
  const { event, response } = createEvent(
    `${SESSION_COOKIE_NAME}=${token}`,
  );
  const handler = createHandler({
    sessions: { findOne: async () => session },
    users: { findOne: async () => user },
  });

  const result = await handler(event);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(result, {
    user: {
      id: userId,
      firstName: "Ana",
      lastName: "Cruz",
      email: "ana@example.com",
      phoneNumber: "+639171234567",
      role: "customer",
    },
  });
});

test("reports a database failure as temporary unavailability", async () => {
  const { event, response, responseHeaders } = createEvent();
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args);
  try {
    const handler = createHandler({}, {
      connect: async () => {
        throw new Error("database details must not be exposed");
      },
    });

    const result = await handler(event);

    assert.equal(response.statusCode, 503);
    assert.equal(responseHeaders["cache-control"], "no-store");
    assert.deepEqual(result, {
      error: "Authentication is temporarily unavailable.",
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(loggedErrors, [
    ["Authentication database unavailable:", "Error"],
  ]);
});
