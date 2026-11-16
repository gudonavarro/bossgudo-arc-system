const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const {
  RESET_COOKIE_NAME,
  createResetCode,
  createResetCodeEmail,
  hashResetCode,
  hashResetToken,
  isResetSecretConfigured,
  matchesResetCodeHash,
  readResetToken,
} = require("../server/utils/password-reset");

const resetSecret = "reset-code-test-secret-that-is-at-least-32-bytes";

test("generates six-digit reset codes and HMACs them with a private secret", () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.match(createResetCode(), /^\d{6}$/);
  }

  const hash = hashResetCode("012345", resetSecret);
  assert.match(hash, /^[a-f\d]{64}$/);
  assert.notEqual(hash, "012345");
  assert.notEqual(hash, hashResetCode("012345", `${resetSecret}-rotated`));
  assert.equal(isResetSecretConfigured("short"), false);
  assert.equal(isResetSecretConfigured(resetSecret), true);
  assert.throws(() => hashResetCode("12345", resetSecret), TypeError);
});

test("compares reset code hashes safely and hashes high-entropy authorization tokens", () => {
  const codeHash = hashResetCode("123456", resetSecret);
  assert.equal(matchesResetCodeHash(codeHash, codeHash), true);
  assert.equal(matchesResetCodeHash(codeHash, hashResetCode("654321", resetSecret)), false);
  assert.equal(matchesResetCodeHash("invalid", codeHash), false);

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  assert.match(tokenHash, /^[a-f\d]{64}$/);
  assert.notEqual(tokenHash, token);
  assert.throws(() => hashResetToken("short"), TypeError);
});

test("reads only valid reset authorization cookies", () => {
  const token = crypto.randomBytes(32).toString("base64url");
  assert.equal(
    readResetToken({
      headers: { cookie: `other=value; ${RESET_COOKIE_NAME}=${token}` },
    }),
    token,
  );
  assert.equal(
    readResetToken({ headers: { cookie: `${RESET_COOKIE_NAME}=not-a-token` } }),
    null,
  );
  assert.equal(
    readResetToken({ headers: { cookie: `${RESET_COOKIE_NAME}=%E0%A4%A` } }),
    null,
  );
  assert.equal(readResetToken({ headers: {} }), null);
});

test("builds a plain-text and HTML reset email with an expiration notice", () => {
  const message = createResetCodeEmail("123456");
  assert.equal(message.subject, "Your BOSSGUDO password reset code");
  assert.match(message.text, /123456/);
  assert.match(message.text, /10 minutes/);
  assert.match(message.html, /123456/);
  assert.match(message.html, /10 minutes/);
  assert.throws(() => createResetCodeEmail("bad"), TypeError);
});
