const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { SESSION_COOKIE_NAME } = require("./session");
const { readCookie } = require("./cookies");
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function readSessionToken(request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCollections(request) {
  if (request.authCollections) {
    return request.authCollections;
  }
  const database = request.mongoDb;
  if (!database) {
    throw new Error("Database is unavailable.");
  }
  return {
    sessions: database.collection("sessions"),
    users: database.collection("users"),
  };
}

function asObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
    ? new ObjectId(value)
    : value;
}

function createAuthenticationMiddleware({
  getCollections: getRequestCollections = getCollections,
  isDatabaseReady = (request) =>
    Boolean(request.authCollections || request.mongoDb),
  requiredRole,
  respondUnauthenticated = (_request, response) =>
    response.status(401).json({ error: "Authentication required." }),
} = {}) {
  return async function authenticateRequest(request, response, next) {
    const token = readSessionToken(request);
    if (!token) {
      return respondUnauthenticated(request, response);
    }
    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Authentication is temporarily unavailable." });
    }

    try {
      const { sessions, users } = getRequestCollections(request);
      const session = await sessions.findOne({
        tokenHash: hashSessionToken(token),
        expiresAt: { $gt: new Date() },
      });
      if (!session) {
        return respondUnauthenticated(request, response);
      }

      const user = await users.findOne(
        { _id: asObjectId(session.userId) },
        {
          projection: {
            firstName: 1,
            lastName: 1,
            email: 1,
            phoneNumber: 1,
            role: 1,
            isActive: 1,
            passwordChangedAt: 1,
          },
        },
      );
      const passwordChangedAfterSession =
        user?.passwordChangedAt?.getTime() > session.createdAt?.getTime();
      if (!user?.isActive || passwordChangedAfterSession) {
        return respondUnauthenticated(request, response);
      }
      if (requiredRole && user.role !== requiredRole) {
        return response.status(403).json({ error: "Forbidden." });
      }

      request.authUser = {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };
      request.authSessionId = session._id;
      return next();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Authentication request failed:", errorName);
      return response
        .status(500)
        .json({ error: "Unable to authenticate this request." });
    }
  };
}

function createRoleAuthenticationMiddleware(requiredRole, options = {}) {
  return createAuthenticationMiddleware({ ...options, requiredRole });
}

module.exports = {
  SESSION_COOKIE_NAME,
  createAuthenticationMiddleware,
  createRoleAuthenticationMiddleware,
};
