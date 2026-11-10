const nodemailer = require("nodemailer");

function getMailConfiguration() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
    MAIL_FROM,
    APP_BASE_URL,
  } = process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !MAIL_FROM ||
    !APP_BASE_URL
  ) {
    return null;
  }

  let baseUrl;
  try {
    baseUrl = new URL(APP_BASE_URL);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
  ) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    from: MAIL_FROM,
    baseUrl: baseUrl.origin,
  };
}

function isPasswordResetMailConfigured() {
  return Boolean(getMailConfiguration());
}

async function sendPasswordResetEmail({ to, token }) {
  const configuration = getMailConfiguration();
  if (!configuration) {
    throw new Error("Password reset email is not configured.");
  }

  const resetUrl = new URL("/reset-password", configuration.baseUrl);
  resetUrl.searchParams.set("token", token);
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: configuration.auth,
  });

  await transporter.sendMail({
    from: configuration.from,
    to,
    subject: "Reset your BOSSGUDO A.R.C. Aqua Farm password",
    text: `Use this one-time link to reset your password. It expires in 30 minutes:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this message.`,
  });
}

module.exports = {
  isPasswordResetMailConfigured,
  sendPasswordResetEmail,
};
