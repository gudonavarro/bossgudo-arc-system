const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { getUserModel } = jiti("../server/models/user.ts");
const connection = mongoose.createConnection();
const UserModel = getUserModel(connection);

function createValidUser(overrides = {}) {
  return new UserModel({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phoneNumber: "+639171234567",
    password: "StrongPass1!",
    ...overrides,
  });
}

function runSaveHooks(document) {
  return UserModel.schema.s.hooks.execPre("save", document, []);
}

test("defines the User fields, defaults, and automatic timestamps", async () => {
  const user = createValidUser({
    firstName: " Ada ",
    lastName: " Lovelace ",
    email: " ADA@EXAMPLE.COM ",
    phoneNumber: " +639171234567 ",
  });
  await user.validate();
  await runSaveHooks(user);

  assert.equal(UserModel.schema.path("_id").instance, "ObjectId");
  assert.equal(UserModel.schema.path("user_id"), undefined);
  assert.equal(UserModel.collection.collectionName, "users");
  assert.equal(user.firstName, "Ada");
  assert.equal(user.lastName, "Lovelace");
  assert.equal(user.email, "ada@example.com");
  assert.equal(user.phoneNumber, "+639171234567");
  assert.equal(user.role, "customer");
  assert.equal(user.isActive, true);
  assert.equal(UserModel.schema.options.timestamps, true);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.updatedAt instanceof Date);
});

test("validates email and role and declares unique indexes", async () => {
  await assert.rejects(
    new UserModel().validate(),
    mongoose.Error.ValidationError,
  );
  await assert.rejects(
    createValidUser({ email: "not-an-email" }).validate(),
    mongoose.Error.ValidationError,
  );
  await assert.rejects(
    createValidUser({ role: "owner" }).validate(),
    mongoose.Error.ValidationError,
  );

  const indexes = UserModel.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.email === 1 && options.unique));
  assert.ok(
    indexes.some(([keys, options]) => keys.phoneNumber === 1 && options.unique),
  );
});

test("hashes modified passwords without rehashing existing bcrypt hashes", async () => {
  const user = createValidUser();
  await runSaveHooks(user);
  assert.notEqual(user.password, "StrongPass1!");
  assert.equal(await bcrypt.compare("StrongPass1!", user.password), true);

  const existingHash = user.password;
  const existingUser = createValidUser({ password: existingHash });
  await runSaveHooks(existingUser);
  assert.equal(existingUser.password, existingHash);

  const unchangedUser = createValidUser();
  unchangedUser.isModified = () => false;
  await runSaveHooks(unchangedUser);
  assert.equal(unchangedUser.password, "StrongPass1!");
});

test("excludes sensitive fields by default and permits explicit selection", () => {
  assert.equal(UserModel.schema.path("password").options.select, false);
  assert.equal(UserModel.schema.path("resetTokenHash").options.select, false);

  const projection = UserModel.findOne()
    .select("+password +resetTokenHash")
    .projection();
  assert.equal(projection["+password"], 1);
  assert.equal(projection["+resetTokenHash"], 1);
});

test("returns the existing model rather than recompiling it", () => {
  assert.equal(getUserModel(connection), UserModel);
});

test("uses the same MongoClient class as Mongoose for shared connections", () => {
  assert.equal(mongoose.mongo.MongoClient, MongoClient);
});
