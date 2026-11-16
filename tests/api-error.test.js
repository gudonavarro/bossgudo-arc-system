const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { getApiErrorMessage } = jiti("../app/utils/api-error.ts");

test("returns a safe server error message when available", () => {
  assert.equal(
    getApiErrorMessage(
      { data: { error: "Verification code expired." } },
      "Fallback",
    ),
    "Verification code expired.",
  );
});

test("uses the fallback for network errors and unexpected response shapes", () => {
  for (const error of [
    new TypeError("fetch failed"),
    { data: { message: "Internal database details." } },
    { data: null },
    null,
  ]) {
    assert.equal(getApiErrorMessage(error, "Safe fallback."), "Safe fallback.");
  }
});
