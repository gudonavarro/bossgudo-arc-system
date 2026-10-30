const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const User = require("../models/User");

const SESSION_COOKIE_NAME = "bossgudo_session";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function readSessionToken(request) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return null;

  const cookiePrefix = `${SESSION_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));
  if (!cookie) return null;

  let token;
  try {
    token = decodeURIComponent(cookie.slice(cookiePrefix.length));
  } catch {
    return null;
  }
  return SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAuthenticationMiddleware({
  SessionModel = Session,
  UserModel = User,
  isDatabaseReady = () => mongoose.connection.readyState === 1,
} = {}) {
  return async function authenticateRequest(request, response, next) {
    const token = readSessionToken(request);
    if (!token) {
      return response.status(401).json({ error: "Authentication required." });
    }
    if (!isDatabaseReady()) {
      return response
        .status(503)
        .json({ error: "Authentication is temporarily unavailable." });
    }

    try {
      const session = await SessionModel.findOne({
        tokenHash: hashSessionToken(token),
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!session) {
        return response.status(401).json({ error: "Authentication required." });
      }

      const user = await UserModel.findById(session.userId)
        .select("firstName lastName email role isActive")
        .lean();
      if (!user || !user.isActive) {
        return response.status(401).json({ error: "Authentication required." });
      }

      request.authUser = {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };
      request.authSessionId = session._id;
      return next();
    } catch (error) {
      console.error("Authentication request failed:", error?.name || "Error");
      return response
        .status(500)
        .json({ error: "Unable to authenticate this request." });
    }
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  createAuthenticationMiddleware,
};
