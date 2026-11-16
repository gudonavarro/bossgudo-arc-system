const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "bossgudo_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

async function createSession(sessions, userId, now = new Date()) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await sessions.insertOne({
    userId,
    tokenHash,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return { token, expiresAt };
}

async function invalidateSession(sessions, sessionId) {
  await sessions.deleteOne({ _id: sessionId });
}

function clearSessionCookie(response, isProduction) {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  clearSessionCookie,
  createSession,
  invalidateSession,
};
