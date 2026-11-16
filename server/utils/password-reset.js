const crypto = require("node:crypto");
const path = require("node:path");
const serverUtilsPath = (fileName) =>
  path.resolve(process.cwd(), "server", "utils", fileName);
const { readCookie } = require(serverUtilsPath("cookies.js"));

const RESET_CODE_PATTERN = /^\d{6}$/;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RESET_COOKIE_NAME = "bossgudo_password_reset";

function isResetSecretConfigured(secret) {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 32;
}

function createResetCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashResetCode(code, secret, context) {
  if (
    !RESET_CODE_PATTERN.test(code) ||
    !isResetSecretConfigured(secret) ||
    typeof context !== "string" ||
    !context
  ) {
    throw new TypeError("Invalid password reset code configuration.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(context)
    .update("\0")
    .update(code)
    .digest("hex");
}

function hashResetToken(token) {
  if (typeof token !== "string" || !RESET_TOKEN_PATTERN.test(token)) {
    throw new TypeError("Invalid password reset authorization.");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

function matchesResetCodeHash(storedHash, submittedHash) {
  if (
    typeof storedHash !== "string" ||
    typeof submittedHash !== "string" ||
    !/^[a-f\d]{64}$/i.test(storedHash) ||
    !/^[a-f\d]{64}$/i.test(submittedHash)
  ) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(storedHash, "hex"),
    Buffer.from(submittedHash, "hex"),
  );
}

function readResetToken(request) {
  const token = readCookie(request, RESET_COOKIE_NAME);
  return RESET_TOKEN_PATTERN.test(token) ? token : null;
}

function createResetCodeEmail(code) {
  if (!RESET_CODE_PATTERN.test(code)) {
    throw new TypeError("Invalid password reset code.");
  }
  return {
    subject: "Your BOSSGUDO password reset code",
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: [
      '<div style="font-family:Arial,sans-serif;color:#24312b;line-height:1.6">',
      "<h1 style=\"color:#176b4d;font-size:22px\">Reset your password</h1>",
      "<p>Use this verification code to reset your BOSSGUDO A.R.C. Aqua Farm password:</p>",
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#176b4d">${code}</p>`,
      "<p>This code expires in <strong>10 minutes</strong>. If you did not request it, you can ignore this email.</p>",
      "</div>",
    ].join(""),
  };
}

module.exports = {
  RESET_COOKIE_NAME,
  createResetCode,
  createResetCodeEmail,
  hashResetCode,
  hashResetToken,
  isResetSecretConfigured,
  matchesResetCodeHash,
  readResetToken,
};
