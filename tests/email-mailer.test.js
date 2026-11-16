const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const test = require("node:test");
const {
  isValidEmailAddress,
  sendEmail,
} = require("../server/utils/email-mailer");

const smtpConfig = {
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "sender@example.com",
  smtpPass: "test-password",
  smtpFrom: "sender@example.com",
};

test("validates a single recipient email address", () => {
  assert.equal(isValidEmailAddress(" person@example.com "), true);
  for (const address of [
    "",
    "person",
    "person@localhost",
    "person..name@example.com",
    ".person@example.com",
    "person@example..com",
    "person@example.com,other@example.com",
    `${"a".repeat(65)}@example.com`,
    `${"a".repeat(250)}@example.com`,
    null,
  ]) {
    assert.equal(isValidEmailAddress(address), false);
  }
});

test("sends text and HTML through configured Gmail SMTP", async () => {
  const originalCreateTransport = nodemailer.createTransport;
  let transportOptions;
  let sentMessage;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      async sendMail(message) {
        sentMessage = message;
      },
    };
  };

  try {
    await sendEmail(
      {
        to: " recipient@example.com ",
        subject: "A test message",
        text: "Plain text",
        html: "<p>HTML</p>",
      },
      smtpConfig,
    );
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }

  assert.deepEqual(transportOptions, {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: "sender@example.com", pass: "test-password" },
  });
  assert.deepEqual(sentMessage, {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "A test message",
    text: "Plain text",
    html: "<p>HTML</p>",
  });
});

test("rejects invalid recipients and incomplete private SMTP configuration", async () => {
  await assert.rejects(
    sendEmail(
      { to: "not-an-address", subject: "Test", text: "Body" },
      smtpConfig,
    ),
    { name: "TypeError", message: "Enter a valid recipient email address." },
  );
  await assert.rejects(
    sendEmail(
      { to: "recipient@example.com", subject: "Test", text: "Body" },
      { ...smtpConfig, smtpPass: "" },
    ),
    { message: "Email service is not configured." },
  );
});

test("does not expose SMTP errors or credentials", async () => {
  const originalCreateTransport = nodemailer.createTransport;
  nodemailer.createTransport = () => ({
    async sendMail() {
      throw new Error("Authentication failed with private SMTP details.");
    },
  });

  try {
    await assert.rejects(
      sendEmail(
        { to: "recipient@example.com", subject: "Test", text: "Body" },
        smtpConfig,
      ),
      (error) => {
        assert.equal(error.message, "Unable to send email.");
        assert.equal(error.cause, undefined);
        assert.equal(error.message.includes(smtpConfig.smtpPass), false);
        return true;
      },
    );
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }
});
