const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  getSafeRedirectPath,
  normalizeLoginEmail,
  toAuthUser,
  validateLoginCredentials,
} = jiti("../app/utils/customer-auth.ts");

test("normalizes email and validates login credentials", () => {
  assert.equal(normalizeLoginEmail("  ANA@EXAMPLE.COM "), "ana@example.com");
  assert.equal(validateLoginCredentials("  Ana@Example.com ", "secret"), null);
  assert.equal(
    validateLoginCredentials("  ", "secret"),
    "Enter your email address and password.",
  );
  assert.equal(
    validateLoginCredentials("not-an-email", "secret"),
    "Enter a valid email address.",
  );
  for (const email of [
    "@example.com",
    "user@.com",
    "user@example.",
    "user@@example.com",
    "user name@example.com",
    "user@example .com",
  ]) {
    assert.equal(
      validateLoginCredentials(email, "secret"),
      "Enter a valid email address.",
    );
  }
  assert.equal(validateLoginCredentials("user@sub.example.com", "secret"), null);
});

test("accepts only safe same-site redirect paths", () => {
  assert.equal(
    getSafeRedirectPath("/mybookings?tab=visits"),
    "/mybookings?tab=visits",
  );
  assert.equal(getSafeRedirectPath("https://example.com"), null);
  assert.equal(getSafeRedirectPath("//example.com"), null);
  assert.equal(getSafeRedirectPath("/\\example.com"), null);
  assert.equal(getSafeRedirectPath("/mybookings\n"), null);
});

test("keeps only safe user fields in frontend authentication state", () => {
  assert.deepEqual(
    toAuthUser({
      id: "customer-1",
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      phoneNumber: "555-0100",
      role: "customer",
      password: "hash",
      resetTokenHash: "reset-hash",
      sessionToken: "raw-token",
    }),
    {
      id: "customer-1",
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      phoneNumber: "555-0100",
      role: "customer",
    },
  );
  assert.equal(toAuthUser({ id: "admin", role: "owner" }), null);
});
