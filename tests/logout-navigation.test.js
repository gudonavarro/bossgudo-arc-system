const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  getLogoutCancelRedirect,
  getLogoutRedirect,
} = jiti("../app/utils/logout-navigation.ts");

test("redirects each role to its own login page after logout", () => {
  assert.equal(getLogoutRedirect("admin"), "/admin-login");
  assert.equal(getLogoutRedirect("customer"), "/customer-login");
  assert.equal(getLogoutRedirect(null), "/customer-login");
});

test("returns to a safe page when logout is canceled", () => {
  assert.equal(getLogoutCancelRedirect("/mybookings", "customer"), "/mybookings");
  assert.equal(getLogoutCancelRedirect("/admin", "admin"), "/admin");
  assert.equal(getLogoutCancelRedirect("//example.com", "admin"), "/admin");
  assert.equal(getLogoutCancelRedirect("https://example.com", "customer"), "/");
});
