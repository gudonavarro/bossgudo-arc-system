const crypto = require("node:crypto");

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

module.exports = { SESSION_DURATION_MS, createSession };
