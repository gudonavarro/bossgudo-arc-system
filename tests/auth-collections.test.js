const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { createAuthCollections } = jiti("../server/utils/auth-collections.ts");
const { getSessionModel } = jiti("../server/models/session.ts");
const { getUserModel } = jiti("../server/models/user.ts");
const connection = mongoose.createConnection();
const authCollections = createAuthCollections(
  getUserModel(connection),
  getSessionModel(connection),
);

test("Mongoose repository explicitly selects the hidden password for login", () => {
  const query = authCollections.users.findOne(
    { email: "ana@example.com" },
    {
      projection: {
        _id: 1,
        firstName: 1,
        email: 1,
        password: 1,
        resetCodeAttempts: 1,
        role: 1,
        isActive: 1,
      },
    },
  );

  assert.deepEqual(query.projection(), {
    _id: 1,
    firstName: 1,
    email: 1,
    "+password": 1,
    "+resetCodeAttempts": 1,
    role: 1,
    isActive: 1,
  });
});
