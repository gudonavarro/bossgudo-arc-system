const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  getRegistrationApiError,
  normalizeRegistrationPhoneNumber,
  validateRegistration,
} = jiti("../app/utils/registration.ts");

const validRegistration = {
  firstName: "Ana",
  lastName: "Cruz",
  email: "ana@example.com",
  phoneNumber: "0917 123 4567",
  password: "StrongPass1!",
  confirmPassword: "StrongPass1!",
};

test("normalizes Philippine mobile numbers consistently", () => {
  assert.equal(normalizeRegistrationPhoneNumber("0917 123 4567"), "+639171234567");
  assert.equal(normalizeRegistrationPhoneNumber("(+63) 917-123-4567"), "+639171234567");
});

test("accepts valid registration details", () => {
  assert.deepEqual(validateRegistration(validRegistration), {});
});

test("reports invalid registration fields independently", () => {
  assert.deepEqual(
    validateRegistration({
      ...validRegistration,
      firstName: " ",
      email: "bad-email",
      phoneNumber: "12345",
      password: "weak",
      confirmPassword: "different",
    }),
    {
      firstName: "Enter a first name of at most 80 characters.",
      email: "Enter a valid email address.",
      phoneNumber: "Enter a valid PH number starting with 09 or +63.",
      password:
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
      confirmPassword: "Passwords do not match.",
    },
  );
});

test("rejects passwords that exceed bcrypt's UTF-8 byte limit", () => {
  const password = `StrongPass1!${"é".repeat(31)}`;
  const errors = validateRegistration({
    ...validRegistration,
    password,
    confirmPassword: password,
  });

  assert.ok(errors.password);
});

test("extracts safe server messages and known field errors", () => {
  assert.deepEqual(
    getRegistrationApiError({
      data: {
        error: "An account with those details already exists.",
        fieldErrors: {
          email: "An account with this email already exists.",
          password: { internal: "ignored" },
          database: "ignored",
        },
      },
    }),
    {
      message: "An account with those details already exists.",
      fieldErrors: {
        email: "An account with this email already exists.",
      },
    },
  );
});

test("uses a safe fallback for network and unexpected server errors", () => {
  assert.deepEqual(getRegistrationApiError(new TypeError("fetch failed")), {
    message: "Unable to create your account right now. Please try again.",
    fieldErrors: {},
  });
  assert.deepEqual(
    getRegistrationApiError({ data: { message: "internal database details" } }),
    {
      message: "Unable to create your account right now. Please try again.",
      fieldErrors: {},
    },
  );
});
