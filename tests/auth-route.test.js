const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const request = require("supertest");
const test = require("node:test");
const Session = require("../server/models/Session");
const { createAuthRouter } = require("../server/utils/auth-router");
const { SESSION_COOKIE_NAME } = require("../server/utils/authenticate");

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
  const calls = {
    findOne: [],
    findById: [],
    findOneAndUpdate: [],
    updateOne: [],
    select: [],
    create: [],
  };
  return {
    calls,
    findOne(query) {
      calls.findOne.push(query);
      return fakeQuery(existingUser, calls);
    },
    findById(id) {
      calls.findById.push(id);
      return fakeQuery(existingUser, calls);
    },
    findOneAndUpdate(query, update, options) {
      calls.findOneAndUpdate.push({ query, update, options });
      const matches =
        existingUser?.resetTokenHash === query.resetTokenHash &&
        existingUser.resetTokenExpires > query.resetTokenExpires.$gt;
      if (matches) {
        Object.assign(existingUser, update.$set);
        for (const key of Object.keys(update.$unset)) delete existingUser[key];
      }
      return fakeQuery(matches ? existingUser : null, calls);
    },
    async updateOne(query, update) {
      calls.updateOne.push({ query, update });
      if (existingUser?._id === query._id) {
        for (const key of Object.keys(update.$unset)) delete existingUser[key];
      }
      return { modifiedCount: 1 };
    },
    async create(user) {
      calls.create.push(user);
      if (createError) throw createError;
      return { id: "user-1", ...user };
    },
  };
}

function fakeQuery(value, calls) {
  return {
    select(selection) {
      calls.select.push(selection);
      return this;
    },
    lean: async () => value,
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function fakeSessionModel({
  session = null,
  createError = null,
  deleteError = null,
} = {}) {
  const calls = { create: [], findOne: [], deleteOne: [], deleteMany: [] };
  return {
    calls,
    async create(value) {
      calls.create.push(value);
      if (createError) throw createError;
      return { id: "session-1", ...value };
    },
    findOne(query) {
      calls.findOne.push(query);
      const isUnexpired =
        session && session.expiresAt > query.expiresAt.$gt;
      return { lean: async () => (isUnexpired ? session : null) };
    },
    async deleteOne(query) {
      calls.deleteOne.push(query);
      if (deleteError) throw deleteError;
      return { deletedCount: 1 };
    },
    async deleteMany(query) {
      calls.deleteMany.push(query);
      return { deletedCount: 1 };
    },
  };
}

function createLoginUser(overrides = {}) {
  return {
    _id: "user-1",
    id: "user-1",
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    role: "customer",
    isActive: true,
    async save() {
      return this;
    },
    async comparePassword(password) {
      return password === "StrongPass1!";
    },
    ...overrides,
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
    {
      ...validRegistration,
      password: `StrongPass1!${"x".repeat(70)}`,
      confirmPassword: `StrongPass1!${"x".repeat(70)}`,
    },
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

test("validates login input before database access", async () => {
  const model = fakeUserModel();
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  for (const body of [
    {},
    { email: "not-an-email", password: "pass" },
    { email: "ana@example.com", password: "" },
    { email: "ana@example.com", password: 123 },
    { email: "ana@example.com", password: `StrongPass1!${"x".repeat(70)}` },
  ]) {
    const response = await request(app).post("/api/auth/login").send(body);
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error, "string");
  }
  assert.equal(model.calls.findOne.length, 0);
});

test("rate limits repeated login attempts", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });

  const responses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    responses.push(await request(app).post("/api/auth/login").send({}));
  }

  assert.equal(responses.slice(0, 10).every((response) => response.status === 400), true);
  assert.equal(responses[10].status, 429);
});

test("returns unavailable when the database is disconnected for login", async () => {
  const model = fakeUserModel();
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => false,
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });

  assert.equal(response.status, 503);
  assert.equal(model.calls.findOne.length, 0);
});

test("verifies credentials using the selected password and returns safe user data", async () => {
  const user = createLoginUser();
  const model = fakeUserModel({ existingUser: user });
  const sessions = fakeSessionModel();
  const app = createTestApp({
    UserModel: model,
    SessionModel: sessions,
    isDatabaseReady: () => true,
    isProduction: () => true,
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: " ANA@EXAMPLE.COM ", password: "StrongPass1!" });

  assert.equal(response.status, 200);
  assert.equal(model.calls.findOne[0].email, "ana@example.com");
  assert.deepEqual(model.calls.select, ["+password"]);
  assert.equal(sessions.calls.create.length, 1);
  assert.equal(sessions.calls.create[0].userId, "user-1");
  assert.match(sessions.calls.create[0].tokenHash, /^[a-f0-9]{64}$/);
  assert.ok(sessions.calls.create[0].expiresAt > new Date());
  const cookie = response.headers["set-cookie"][0];
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /;\s*Secure/i);
  assert.deepEqual(response.body.user, {
    id: "user-1",
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    role: "customer",
  });
  assert.equal(response.body.message, "Login successful.");
  assert.equal("password" in response.body.user, false);
  assert.equal(
    JSON.stringify(response.body).includes(response.headers["set-cookie"][0].split("=")[1].split(";")[0]),
    false,
  );
});

test("uses the same unauthorized response for bad passwords and unknown accounts", async () => {
  const existingUserModel = fakeUserModel({
    existingUser: createLoginUser(),
  });
  const existingUserApp = createTestApp({
    UserModel: existingUserModel,
    isDatabaseReady: () => true,
  });
  const unknownUserApp = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });

  const badPasswordResponse = await request(existingUserApp)
    .post("/api/auth/login")
    .send({ email: "ana@example.com", password: "WrongPass1!" });
  const unknownUserResponse = await request(unknownUserApp)
    .post("/api/auth/login")
    .send({ email: "nobody@example.com", password: "WrongPass1!" });

  assert.equal(badPasswordResponse.status, 401);
  assert.deepEqual(unknownUserResponse.body, badPasswordResponse.body);
});

test("rejects inactive users with the same unauthorized response", async () => {
  const model = fakeUserModel({
    existingUser: createLoginUser({ isActive: false }),
  });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Invalid email or password." });
});

test("protects the current-user route and rejects missing and invalid cookies", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });

  const noCookie = await request(app).get("/api/auth/me");
  const badCookie = await request(app)
    .get("/api/auth/me")
    .set("Cookie", `${SESSION_COOKIE_NAME}=not-a-token`);

  assert.equal(noCookie.status, 401);
  assert.equal(badCookie.status, 401);
});

test("returns a clean signed-out status without treating it as an API failure", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => false,
  });

  const response = await request(app).get("/api/auth/session");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { user: null });
});

test("authenticates using a hashed token, active user, and returns minimal identity", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: "user-1",
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
  };
  const sessions = fakeSessionModel({ session });
  const userModel = fakeUserModel({ existingUser: createLoginUser() });
  const app = createTestApp({
    UserModel: userModel,
    SessionModel: sessions,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .get("/api/auth/me")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

  assert.equal(response.status, 200);
  assert.equal(sessions.calls.findOne[0].tokenHash, session.tokenHash);
  assert.ok(sessions.calls.findOne[0].expiresAt.$gt instanceof Date);
  assert.deepEqual(userModel.calls.findById, ["user-1"]);
  assert.deepEqual(response.body.user, {
    id: "user-1",
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    role: "customer",
  });
});

test("rejects expired sessions and inactive accounts", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiredSession = {
    _id: "session-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() - 60_000),
  };
  const expiredApp = createTestApp({
    UserModel: fakeUserModel({ existingUser: createLoginUser() }),
    SessionModel: fakeSessionModel({ session: expiredSession }),
    isDatabaseReady: () => true,
  });
  const inactiveSession = {
    ...expiredSession,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const inactiveApp = createTestApp({
    UserModel: fakeUserModel({
      existingUser: createLoginUser({ isActive: false }),
    }),
    SessionModel: fakeSessionModel({ session: inactiveSession }),
    isDatabaseReady: () => true,
  });

  const expiredResponse = await request(expiredApp)
    .get("/api/auth/me")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
  const inactiveResponse = await request(inactiveApp)
    .get("/api/auth/me")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

  assert.equal(expiredResponse.status, 401);
  assert.equal(inactiveResponse.status, 401);
});

test("rejects sessions created before the user's password was changed", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(Date.now() - 60_000),
  };
  const app = createTestApp({
    UserModel: fakeUserModel({
      existingUser: createLoginUser({
        passwordChangedAt: new Date(),
      }),
    }),
    SessionModel: fakeSessionModel({ session }),
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .get("/api/auth/me")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

  assert.equal(response.status, 401);
});

test("logs out by revoking the session and clearing the cookie", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
  };
  const sessions = fakeSessionModel({ session });
  const app = createTestApp({
    UserModel: fakeUserModel({ existingUser: createLoginUser() }),
    SessionModel: sessions,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/logout")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

  assert.equal(response.status, 200);
  assert.deepEqual(sessions.calls.deleteOne, [{ _id: "session-1" }]);
  assert.match(response.headers["set-cookie"][0], new RegExp(`^${SESSION_COOKIE_NAME}=;`));
  assert.match(response.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/i);
});

test("defines a unique token hash and expiration cleanup index", () => {
  const indexes = Session.schema.indexes();

  assert.ok(
    indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique),
  );
  assert.ok(indexes.some(([keys]) => keys.userId === 1));
  assert.ok(
    indexes.some(
      ([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
  assert.equal(Session.schema.path("tokenHash").options.select, false);
});

test("does not claim email recovery when SMTP is not configured", async () => {
  const model = fakeUserModel({ existingUser: createLoginUser() });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    passwordResetMailConfigured: () => false,
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ana@example.com" });

  assert.equal(response.status, 503);
  assert.match(response.body.error, /no email was sent/i);
  assert.equal(model.calls.findOne.length, 0);
});

test("sends a one-time reset token but stores only its hash", async () => {
  const user = createLoginUser();
  const model = fakeUserModel({ existingUser: user });
  const sentEmails = [];
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    passwordResetMailConfigured: () => true,
    sendResetEmail: async (message) => sentEmails.push(message),
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ANA@EXAMPLE.COM" });

  assert.equal(response.status, 202);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "ana@example.com");
  assert.equal(
    user.resetTokenHash,
    crypto.createHash("sha256").update(sentEmails[0].token).digest("hex"),
  );
  assert.notEqual(user.resetTokenHash, sentEmails[0].token);
  assert.ok(user.resetTokenExpires > new Date());
  assert.equal(JSON.stringify(response.body).includes(sentEmails[0].token), false);
});

test("returns the same recovery response for an unknown account", async () => {
  const sentEmails = [];
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
    passwordResetMailConfigured: () => true,
    sendResetEmail: async (message) => sentEmails.push(message),
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "unknown@example.com" });

  assert.equal(response.status, 202);
  assert.deepEqual(response.body, {
    message:
      "If an active account matches that email, password reset instructions will be sent.",
  });
  assert.equal(sentEmails.length, 0);
});

test("clears a reset token when email delivery fails", async () => {
  const user = createLoginUser();
  const model = fakeUserModel({ existingUser: user });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    passwordResetMailConfigured: () => true,
    sendResetEmail: async () => {
      throw new Error("SMTP unavailable");
    },
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ana@example.com" });

  assert.equal(response.status, 503);
  assert.equal(model.calls.updateOne.length, 1);
  assert.equal("resetTokenHash" in user, false);
  assert.equal("resetTokenExpires" in user, false);
});

test("resets a password once and revokes existing sessions", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = createLoginUser({
    resetTokenHash: tokenHash,
    resetTokenExpires: new Date(Date.now() + 60_000),
  });
  const model = fakeUserModel({ existingUser: user });
  const sessions = fakeSessionModel();
  const app = createTestApp({
    UserModel: model,
    SessionModel: sessions,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token,
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const reusedTokenResponse = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token,
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });

  assert.equal(response.status, 200);
  assert.equal(reusedTokenResponse.status, 400);
  assert.match(user.password, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await bcrypt.compare("NewStrongPass1!", user.password), true);
  assert.equal("resetTokenHash" in user, false);
  assert.equal("resetTokenExpires" in user, false);
  assert.deepEqual(sessions.calls.deleteMany, [{ userId: "user-1" }]);
  assert.equal(model.calls.findOneAndUpdate[0].query.resetTokenHash, tokenHash);
  assert.ok(user.passwordChangedAt instanceof Date);
});

test("rejects expired and malformed reset tokens", async () => {
  const expiredToken = crypto.randomBytes(32).toString("base64url");
  const user = createLoginUser({
    resetTokenHash: crypto.createHash("sha256").update(expiredToken).digest("hex"),
    resetTokenExpires: new Date(Date.now() - 60_000),
  });
  const app = createTestApp({
    UserModel: fakeUserModel({ existingUser: user }),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });

  const expired = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token: expiredToken,
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const malformed = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token: "not-a-token",
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const tooLongPassword = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token: expiredToken,
      password: `NewStrongPass1!${"x".repeat(70)}`,
      confirmPassword: `NewStrongPass1!${"x".repeat(70)}`,
    });

  assert.equal(expired.status, 400);
  assert.equal(malformed.status, 400);
  assert.equal(tooLongPassword.status, 400);
  assert.equal(user.password, undefined);
});
