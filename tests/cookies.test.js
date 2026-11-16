const assert = require("node:assert/strict");
const test = require("node:test");
const { readCookie } = require("../server/utils/cookies");

test("reads and decodes the named cookie", () => {
  assert.equal(
    readCookie(
      { headers: { cookie: "other=value; session=encoded%20value" } },
      "session",
    ),
    "encoded value",
  );
});

test("returns null for missing or malformed cookies", () => {
  assert.equal(readCookie(null, "session"), null);
  assert.equal(readCookie({ headers: {} }, "session"), null);
  assert.equal(readCookie({ headers: { cookie: "sessionx=value" } }, "session"), null);
  assert.equal(
    readCookie({ headers: { cookie: "session=%E0%A4%A" } }, "session"),
    null,
  );
});
