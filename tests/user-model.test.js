const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

test("normalizes email and Philippine phone, with safe defaults", () => {
  const user = new User({
    firstName: "  Ana ",
    lastName: " Cruz ",
    email: " ANA@EXAMPLE.COM ",
    phoneNumber: "0917 123 4567",
    password: "$2b$12$" + "a".repeat(53),
  });

  assert.equal(user.firstName, "Ana");
  assert.equal(user.lastName, "Cruz");
  assert.equal(user.email, "ana@example.com");
  assert.equal(user.phoneNumber, "+639171234567");
  assert.equal(user.role, "customer");
  assert.equal(user.isActive, true);
  assert.equal(User.schema.options.timestamps, true);
});

test("hashes passwords and validates required identity fields", async () => {
  const user = new User({
    email: "not-an-email",
    password: "PlaintextPassword1!",
  });
  const error = await user.validate().then(
    () => null,
    (validationError) => validationError,
  );

  assert.ok(error);
  assert.ok(error.errors.email);
  assert.ok(error.errors.firstName);
  assert.ok(error.errors.lastName);
  assert.ok(error.errors.phoneNumber);
  assert.match(user.password, /^\$2[aby]\$\d{2}\$/);
});

test("compares candidate passwords to the stored bcrypt hash", async () => {
  const password = "StrongPass1!";
  const hash = await bcrypt.hash(password, 4);
  const user = new User({
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    password: hash,
  });

  assert.equal(await user.comparePassword(password), true);
  assert.equal(await user.comparePassword("incorrect"), false);
  assert.equal(User.schema.path("password").options.select, false);
});

test("hashes plaintext passwords before validation", async () => {
  const password = "StrongPass1!";
  const user = new User({
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    password,
  });

  await user.validate();

  assert.notEqual(user.password, password);
  assert.match(user.password, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await bcrypt.compare(password, user.password), true);
});

test("hashes only once during repeated validation and handles hash-shaped input", async () => {
  const password = `$2b$12$${"a".repeat(53)}`;
  const user = new User({
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    password,
  });

  await user.validate();
  const hash = user.password;
  await user.validate();

  assert.notEqual(hash, password);
  assert.equal(user.password, hash);
  assert.equal(await bcrypt.compare(password, hash), true);
});

test("does not serialize password or reset token fields", () => {
  const user = new User({
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    password: "$2b$12$" + "a".repeat(53),
    resetTokenHash: "hashed-token",
    resetTokenExpires: new Date(),
  });
  const serialized = user.toJSON();

  assert.equal("password" in serialized, false);
  assert.equal("resetTokenHash" in serialized, false);
  assert.equal("resetTokenExpires" in serialized, false);
});

test("defines unique indexes for email and reset token hashes", () => {
  const indexes = User.schema.indexes();

  assert.ok(indexes.some(([keys, options]) => keys.email === 1 && options.unique));
  assert.ok(
    indexes.some(
      ([keys, options]) =>
        keys.resetTokenHash === 1 && options.unique && options.sparse,
    ),
  );
});
