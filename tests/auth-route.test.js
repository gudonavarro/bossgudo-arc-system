const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const test = require("node:test");
const { createAuthRouter } = require("../routes/auth");

const validRegistration = {
  firstName: "  Ana ",
  lastName: " Cruz ",
  email: " ANA@EXAMPLE.COM ",
  phoneNumber: "0917 123 4567",
  password: "StrongPass1!",
  confirmPassword: "StrongPass1!",
};

function createTestApp(options) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(options));
  return app;
}

function fakeUserModel({ existingUser = null, createError = null } = {}) {
  const calls = { findOne: [], create: [] };
  return {
    calls,
    findOne(query) {
      calls.findOne.push(query);
      return {
        select() {
          return this;
        },
        lean: async () => existingUser,
      };
    },
    async create(user) {
      calls.create.push(user);
      if (createError) throw createError;
      return { id: "user-1", ...user };
    },
  };
}

test("rejects malformed, missing, weak, and mismatched registration details", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });
  const invalidRegistrations = [
    { ...validRegistration, email: "not-an-email" },
    { ...validRegistration, phoneNumber: "12345" },
    { ...validRegistration, password: "weak", confirmPassword: "weak" },
    { ...validRegistration, confirmPassword: "DifferentPass1!" },
    { ...validRegistration, lastName: " ".repeat(2) },
    { ...validRegistration, role: "admin", password: 123 },
  ];

  for (const body of invalidRegistrations) {
    const response = await request(app).post("/api/auth/register").send(body);
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error, "string");
  }
});

test("returns unavailable when the database is disconnected", async () => {
  const model = fakeUserModel();
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => false,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 503);
  assert.equal(model.calls.findOne.length, 0);
  assert.equal(model.calls.create.length, 0);
});

test("creates a customer with normalized details and a minimal safe response", async () => {
  const model = fakeUserModel();
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send({ ...validRegistration, role: "admin", resetTokenHash: "attacker-value" });

  assert.equal(response.status, 201);
  assert.deepEqual(model.calls.create[0], {
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    password: "StrongPass1!",
    role: "customer",
  });
  assert.deepEqual(response.body.user, {
    id: "user-1",
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    phoneNumber: "+639171234567",
    role: "customer",
  });
  assert.equal(JSON.stringify(response.body).includes("StrongPass1!"), false);
  assert.equal("password" in response.body.user, false);
  assert.equal("resetTokenHash" in response.body.user, false);
});

test("returns conflict for an existing account", async () => {
  const model = fakeUserModel({ existingUser: { _id: "existing" } });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 409);
  assert.equal(model.calls.create.length, 0);
  assert.equal(model.calls.findOne[0].$or[0].email, "ana@example.com");
  assert.equal(model.calls.findOne[0].$or[1].phoneNumber, "+639171234567");
});

test("maps duplicate index races to conflict", async () => {
  const model = fakeUserModel({ createError: { code: 11000 } });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "An account with those details already exists.");
});
