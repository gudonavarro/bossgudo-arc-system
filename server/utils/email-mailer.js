const nodemailer = require("nodemailer");

const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isValidEmailAddress(address) {
  if (typeof address !== "string") {
    return false;
  }

  const normalized = address.trim();
  const [localPart, ...domainParts] = normalized.split("@");
  return (
    normalized.length <= 254 &&
    localPart.length <= 64 &&
    !localPart.startsWith(".") &&
    !localPart.endsWith(".") &&
    !localPart.includes("..") &&
    domainParts.length === 1 &&
    EMAIL_PATTERN.test(normalized)
  );
}

function getSmtpConfiguration(config) {
  const port = Number(config?.smtpPort);
  if (
    typeof config?.smtpHost !== "string" ||
    !config.smtpHost.trim() ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    typeof config.smtpUser !== "string" ||
    !config.smtpUser.trim() ||
    typeof config.smtpPass !== "string" ||
    !config.smtpPass ||
    !isValidEmailAddress(config.smtpFrom)
  ) {
    throw new Error("Email service is not configured.");
  }

  return {
    host: config.smtpHost,
    port,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    from: config.smtpFrom.trim(),
  };
}

async function sendEmail(message, config) {
  if (!message || !isValidEmailAddress(message.to)) {
    throw new TypeError("Enter a valid recipient email address.");
  }
  if (
    typeof message.subject !== "string" ||
    !message.subject.trim() ||
    message.subject.length > 998 ||
    /[\r\n]/.test(message.subject) ||
    (typeof message.text !== "string" && typeof message.html !== "string")
  ) {
    throw new TypeError("Provide a valid email subject and body.");
  }

  const smtp = getSmtpConfiguration(config);
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: false,
      auth: smtp.auth,
    });
    await transporter.sendMail({
      from: smtp.from,
      to: message.to.trim(),
      subject: message.subject,
      ...(typeof message.text === "string" ? { text: message.text } : {}),
      ...(typeof message.html === "string" ? { html: message.html } : {}),
    });
  } catch {
    throw new Error("Unable to send email.");
  }
}

module.exports = { isValidEmailAddress, sendEmail };
