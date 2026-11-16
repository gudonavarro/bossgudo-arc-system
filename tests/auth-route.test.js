const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const request = require("supertest");
const test = require("node:test");
const { createAuthRouter } = require("../server/utils/auth-router");
const {
  hashResetCode,
  hashResetToken,
  RESET_COOKIE_NAME,
} = require("../server/utils/password-reset");
const {
  SESSION_COOKIE_NAME,
  createRoleAuthenticationMiddleware,
} = require("../server/utils/authenticate");

const validRegistration = {
  firstName: "  Ana ",
  lastName: " Cruz ",
  email: " ANA@EXAMPLE.COM ",
  phoneNumber: "0917 123 4567",
  password: "StrongPass1!",
  confirmPassword: "StrongPass1!",
};
const testResetSecret = "test-reset-secret-with-at-least-32-bytes";

function createTestApp(options) {
  const app = express();
  app.use(express.json());
  const userModel = options.UserModel || fakeUserModel();
  const sessionModel = options.SessionModel || fakeSessionModel();
  const getCollections = () => ({
    users: {
      async findOne(query, options = {}) {
        const result = query._id
          ? userModel.findById(query._id)
          : userModel.findOne(query);
        if (options.projection) {
          result.select(
            Object.keys(options.projection)
              .filter((key) => options.projection[key])
              .join(" "),
          );
        }
        return result.lean();
      },
      async insertOne(document) {
        const result = await userModel.create(document);
        return { insertedId: result._id || result.id };
      },
      updateOne(query, update) {
        return userModel.updateOne(query, update);
      },
      findOneAndUpdate(query, update, updateOptions) {
        return userModel.findOneAndUpdate(query, update, updateOptions);
      },
    },
    sessions: {
      async findOne(query) {
        return sessionModel.findOne(query).lean();
      },
      async insertOne(document) {
        const result = await sessionModel.create(document);
        return { insertedId: result._id || result.id };
      },
      deleteOne(query) {
        return sessionModel.deleteOne(query);
      },
      deleteMany(query) {
        return sessionModel.deleteMany(query);
      },
    },
  });
  const {
    UserModel: _userModel,
    SessionModel: _sessionModel,
    emailConfig: configuredEmailConfig,
    ...routerOptions
  } = options;
  const emailConfig = configuredEmailConfig ?? {
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "sender@example.com",
    smtpPass: "test-password",
    smtpFrom: "sender@example.com",
    passwordResetSecret: testResetSecret,
  };
  app.use((request, _response, next) => {
    request.emailConfig = emailConfig;
    next();
  });
  app.use(
    "/api/auth",
    createAuthRouter({ ...routerOptions, getCollections }),
  );
  return app;
}

function createEmailTestApp({
  role = "admin",
  production = false,
  sendTestEmail = async () => {},
} = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: "user-1",
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };
  const emailConfig = {
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "sender@example.com",
    smtpPass: "test-password",
    smtpFrom: "sender@example.com",
  };
  const app = createTestApp({
    UserModel: fakeUserModel({ existingUser: createLoginUser({ role }) }),
    SessionModel: fakeSessionModel({ session }),
    emailConfig,
    isDatabaseReady: () => true,
    isProduction: () => production,
    sendTestEmail,
  });
  return { app, token, emailConfig };
}

function createResetCodeTestApp({
  code = "012345",
  expiresAt = new Date(Date.now() + 10 * 60 * 1000),
  attempts = 0,
} = {}) {
  const user = createLoginUser({
    resetTokenHash: hashResetCode(code, testResetSecret),
    resetTokenExpires: expiresAt,
    resetCodeAttempts: attempts,
  });
  const model = fakeUserModel({ existingUser: user });
  return {
    app: createTestApp({
      UserModel: model,
      isDatabaseReady: () => true,
    }),
    model,
    user,
    code,
  };
}

function fakeUserModel({
  existingUser = null,
  createError = null,
  findError = null,
} = {}) {
  const calls = {
    findOne: [],
    findById: [],
    findOneAndUpdate: [],
    updateOne: [],
    select: [],
    create: [],
    created: [],
  };
  let storedUser = existingUser;
  return {
    calls,
    findOne(query) {
      calls.findOne.push(query);
      if (findError) throw findError;
      return fakeQuery(storedUser, calls);
    },
    findById(id) {
      calls.findById.push(id);
      return fakeQuery(storedUser, calls);
    },
    findOneAndUpdate(query, update, options) {
      calls.findOneAndUpdate.push({ query, update, options });
      const expiryIsValid =
        !query.resetTokenExpires?.$gt ||
        existingUser?.resetTokenExpires > query.resetTokenExpires.$gt;
      const attemptsAreValid =
        !query.resetCodeAttempts?.$lt ||
        (typeof existingUser?.resetCodeAttempts === "number" &&
          existingUser.resetCodeAttempts < query.resetCodeAttempts.$lt);
      const matches =
        existingUser?.resetTokenHash === query.resetTokenHash &&
        expiryIsValid &&
        attemptsAreValid;
      if (matches) {
        Object.assign(existingUser, update.$set || {});
        for (const [key, increment] of Object.entries(update.$inc || {})) {
          existingUser[key] = (existingUser[key] || 0) + increment;
        }
        for (const key of Object.keys(update.$unset || {})) delete existingUser[key];
      }
      return fakeQuery(matches ? existingUser : null, calls);
    },
    async updateOne(query, update) {
      calls.updateOne.push({ query, update });
      if (existingUser?._id === query._id) {
        Object.assign(existingUser, update.$set || {});
        for (const key of Object.keys(update.$unset || {})) {
          delete existingUser[key];
        }
      }
      return { modifiedCount: 1 };
    },
    async create(user) {
      calls.create.push(user);
      if (createError) throw createError;
      const createdUser = {
        id: "user-1",
        ...user,
        password: await bcrypt.hash(user.password, 4),
      };
      calls.created.push(createdUser);
      storedUser = createdUser;
      return createdUser;
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
    phoneNumber: "+639171234567",
    role: "customer",
    isActive: true,
    password: bcrypt.hashSync("StrongPass1!", 4),
    async save() {
      return this;
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
    assert.ok(response.body.fieldErrors);
  }
});

test("returns field-level errors for missing and invalid registration values", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });

  const response = await request(app).post("/api/auth/register").send({
    ...validRegistration,
    firstName: "",
    email: "not-an-email",
    phoneNumber: "12345",
    password: "weak",
    confirmPassword: "different",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.fieldErrors.firstName, "This field is required.");
  assert.equal(response.body.fieldErrors.email, "Enter a valid email address.");
  assert.equal(
    response.body.fieldErrors.phoneNumber,
    "Enter a valid PH number starting with 09 or +63.",
  );
  assert.ok(response.body.fieldErrors.password);
  assert.equal(response.body.fieldErrors.confirmPassword, "Passwords do not match.");
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

test("maps database connection failures to a safe unavailable response", async () => {
  const databaseError = new Error("mongodb://private-connection-details");
  databaseError.name = "MongoServerSelectionError";
  const app = createTestApp({
    UserModel: fakeUserModel({ findError: databaseError }),
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 503);
  assert.equal(response.body.error, "Registration is temporarily unavailable.");
  assert.equal(JSON.stringify(response.body).includes("private-connection-details"), false);
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
  const storedUser = model.calls.created[0];
  assert.equal(storedUser.firstName, "Ana");
  assert.equal(storedUser.lastName, "Cruz");
  assert.equal(storedUser.email, "ana@example.com");
  assert.equal(storedUser.phoneNumber, "+639171234567");
  assert.equal(storedUser.role, "customer");
  assert.equal(storedUser.isActive, true);
  assert.equal(
    await bcrypt.compare(validRegistration.password, storedUser.password),
    true,
  );
  assert.ok(storedUser.createdAt instanceof Date);
  assert.ok(storedUser.updatedAt instanceof Date);
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
  assert.equal(response.headers["set-cookie"], undefined);
});

test("authenticates a customer immediately after successful registration", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });

  const registration = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "ANA@EXAMPLE.COM", password: validRegistration.password });

  assert.equal(registration.status, 201);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, "ana@example.com");
  assert.equal(login.body.user.role, "customer");
  assert.equal("password" in login.body.user, false);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
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

test("identifies which registration fields are already in use", async () => {
  const model = fakeUserModel({
    existingUser: {
      _id: "existing",
      email: "ana@example.com",
      phoneNumber: "+639171234567",
    },
  });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 409);
  assert.equal(
    response.body.fieldErrors.email,
    "An account with this email already exists.",
  );
  assert.equal(
    response.body.fieldErrors.phoneNumber,
    "This phone number is already registered.",
  );
  assert.equal(model.calls.create.length, 0);
});

test("rate limits repeated customer registration attempts", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });
  const responses = [];

  for (let attempt = 0; attempt < 11; attempt += 1) {
    responses.push(
      await request(app)
        .post("/api/auth/register")
        .send({}),
    );
  }

  assert.ok(responses.slice(0, 10).every((response) => response.status === 400));
  assert.equal(responses[10].status, 429);
  assert.equal(responses[10].body.error, "Too many attempts. Please try again later.");
});

test("maps duplicate index races to conflict", async () => {
  const model = fakeUserModel({
    createError: { code: 11000, keyPattern: { email: 1 } },
  });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "An account with those details already exists.");
  assert.equal(
    response.body.fieldErrors.email,
    "An account with this email already exists.",
  );
});

test("maps Mongoose validation failures to safe field errors", async () => {
  const validationError = new Error("private validation details");
  validationError.name = "ValidationError";
  validationError.errors = { email: new Error("invalid") };
  const app = createTestApp({
    UserModel: fakeUserModel({ createError: validationError }),
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Please check your registration details.");
  assert.equal(response.body.fieldErrors.email, "Enter a valid email address.");
  assert.equal(JSON.stringify(response.body).includes("private validation details"), false);
});

test("does not expose unexpected registration persistence errors", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel({ createError: new Error("private database details") }),
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send(validRegistration);

  assert.equal(response.status, 500);
  assert.equal(response.body.error, "Unable to create the account right now.");
  assert.equal(JSON.stringify(response.body).includes("private database details"), false);
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
  assert.deepEqual(model.calls.select, [
    "_id firstName lastName email password role isActive",
  ]);
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

test("rejects administrator accounts from customer login", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel({
      existingUser: createLoginUser({ role: "admin" }),
    }),
    isDatabaseReady: () => true,
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Invalid email or password." });
  assert.equal(response.headers["set-cookie"], undefined);
});

test("administrator login accepts only active administrator accounts", async () => {
  const adminUser = createLoginUser({ role: "admin" });
  const adminSessions = fakeSessionModel();
  const adminApp = createTestApp({
    UserModel: fakeUserModel({ existingUser: adminUser }),
    SessionModel: adminSessions,
    isDatabaseReady: () => true,
    isProduction: () => true,
  });
  const customerApp = createTestApp({
    UserModel: fakeUserModel({ existingUser: createLoginUser() }),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });

  const adminResponse = await request(adminApp)
    .post("/api/auth/admin/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });
  const customerResponse = await request(customerApp)
    .post("/api/auth/admin/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });

  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.body.user.role, "admin");
  assert.equal(adminSessions.calls.create.length, 1);
  assert.deepEqual(adminResponse.body.user, {
    id: "user-1",
    firstName: "Ana",
    lastName: "Cruz",
    email: "ana@example.com",
    role: "admin",
  });
  const [adminCookie = ""] = adminResponse.headers["set-cookie"] ?? [];
  assert.match(adminCookie, /HttpOnly/);
  assert.match(adminCookie, /Secure/);
  assert.match(adminCookie, /SameSite=Lax/);
  const rawToken = adminCookie
    .split(";")[0]
    .slice(`${SESSION_COOKIE_NAME}=`.length);
  assert.equal(
    adminSessions.calls.create[0].tokenHash,
    crypto.createHash("sha256").update(rawToken).digest("hex"),
  );
  assert.notEqual(adminSessions.calls.create[0].tokenHash, rawToken);
  assert.equal(customerResponse.status, 401);
  assert.equal(customerResponse.headers["set-cookie"], undefined);
  assert.deepEqual(customerResponse.body, {
    error: "Invalid email or password.",
  });

  const inactiveAdminApp = createTestApp({
    UserModel: fakeUserModel({
      existingUser: createLoginUser({ role: "admin", isActive: false }),
    }),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });
  const inactiveAdminResponse = await request(inactiveAdminApp)
    .post("/api/auth/admin/login")
    .send({ email: "ana@example.com", password: "StrongPass1!" });
  assert.equal(inactiveAdminResponse.status, 401);
  assert.equal(inactiveAdminResponse.headers["set-cookie"], undefined);
});

test("reusable administrator middleware rejects customer sessions", async () => {
  async function checkRole(role) {
    const token = crypto.randomBytes(32).toString("base64url");
    const session = {
      _id: "session-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const app = express();
    app.get(
      "/admin",
      createRoleAuthenticationMiddleware("admin", {
        isDatabaseReady: () => true,
        getCollections: () => ({
          sessions: { findOne: async () => session },
          users: {
            findOne: async () => ({
                _id: "user-1",
                firstName: "Ana",
                lastName: "Cruz",
                email: "ana@example.com",
                role,
                isActive: true,
            }),
          },
        }),
      }),
      (_request, response) => response.json({ access: "granted" }),
    );
    return request(app)
      .get("/admin")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }

  const customerResponse = await checkRole("customer");
  const adminResponse = await checkRole("admin");
  assert.equal(customerResponse.status, 403);
  assert.equal(adminResponse.status, 200);
});

test("sends a test email only for an authenticated administrator", async () => {
  const sentEmails = [];
  const { app, token, emailConfig } = createEmailTestApp({
    sendTestEmail: async (message, config) => {
      sentEmails.push({ message, config });
    },
  });
  const adminResponse = await request(app)
    .post("/api/auth/admin/email-test")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`)
    .send({ to: "recipient@example.com" });

  const unauthenticated = await request(createEmailTestApp().app)
    .post("/api/auth/admin/email-test")
    .send({ to: "recipient@example.com" });
  const customerTest = createEmailTestApp({ role: "customer" });
  const customerResponse = await request(customerTest.app)
    .post("/api/auth/admin/email-test")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${customerTest.token}`)
    .send({ to: "recipient@example.com" });

  assert.equal(adminResponse.status, 200);
  assert.deepEqual(adminResponse.body, { message: "Test email sent." });
  assert.deepEqual(sentEmails, [
    {
      message: {
        to: "recipient@example.com",
        subject: "BOSSGUDO SMTP email test",
        text: "This is a test email from the BOSSGUDO A.R.C. Aqua Farm server.",
        html: "<p>This is a test email from the BOSSGUDO A.R.C. Aqua Farm server.</p>",
      },
      config: emailConfig,
    },
  ]);
  assert.equal(unauthenticated.status, 401);
  assert.equal(customerResponse.status, 403);
});

test("hides the test route in production and validates recipients", async () => {
  const productionTest = createEmailTestApp({ production: true });
  const productionResponse = await request(productionTest.app)
    .post("/api/auth/admin/email-test")
    .send({ to: "recipient@example.com" });
  const invalidRecipient = createEmailTestApp();
  const invalidResponse = await request(invalidRecipient.app)
    .post("/api/auth/admin/email-test")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${invalidRecipient.token}`)
    .send({ to: "invalid-address" });

  assert.equal(productionResponse.status, 404);
  assert.deepEqual(productionResponse.body, { error: "Not found." });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(invalidResponse.body, {
    error: "Enter a valid recipient email address.",
  });
});

test("does not expose SMTP details when the test email fails", async () => {
  const loggedErrors = [];
  const testApp = createEmailTestApp({
    sendTestEmail: async () => {
      throw new Error("SMTP authentication details must remain private.");
    },
  });
  const originalConsoleError = console.error;
  console.error = (...values) => loggedErrors.push(values);

  let response;
  try {
    response = await request(testApp.app)
      .post("/api/auth/admin/email-test")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${testApp.token}`)
      .send({ to: "recipient@example.com" });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    error: "Unable to send test email.",
  });
  assert.deepEqual(loggedErrors, [["Email test failed:", "Error"]]);
  assert.equal(JSON.stringify(response.body).includes("authentication details"), false);
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
  const userModel = fakeUserModel({
    existingUser: createLoginUser({
      resetTokenHash: "must-not-be-returned",
      resetTokenExpires: new Date(),
    }),
  });
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
    phoneNumber: "+639171234567",
    role: "customer",
  });
  assert.equal("password" in response.body.user, false);
  assert.equal("resetTokenHash" in response.body.user, false);
  assert.equal("resetTokenExpires" in response.body.user, false);
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

test("logs out customers and administrators by revoking only the current session", async () => {
  for (const role of ["customer", "admin"]) {
    const token = crypto.randomBytes(32).toString("base64url");
    const sessionId = `session-${role}`;
    const session = {
      _id: sessionId,
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const sessions = fakeSessionModel({ session });
    const app = createTestApp({
      UserModel: fakeUserModel({
        existingUser: createLoginUser({ role }),
      }),
      SessionModel: sessions,
      isDatabaseReady: () => true,
    });

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(sessions.calls.deleteOne, [{ _id: sessionId }]);
    assert.match(
      response.headers["set-cookie"][0],
      new RegExp(`^${SESSION_COOKIE_NAME}=;`),
    );
    assert.match(response.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/i);
  }
});

test("clears the session cookie when logout has no valid session", async () => {
  const app = createTestApp({
    UserModel: fakeUserModel(),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });

  const noCookie = await request(app).post("/api/auth/logout");
  const expiredCookie = await request(app)
    .post("/api/auth/logout")
    .set(
      "Cookie",
      `${SESSION_COOKIE_NAME}=${crypto.randomBytes(32).toString("base64url")}`,
    );

  assert.equal(noCookie.status, 200);
  assert.equal(expiredCookie.status, 200);
  assert.equal(noCookie.body.message, "Logged out.");
  assert.match(
    noCookie.headers["set-cookie"][0],
    new RegExp(`^${SESSION_COOKIE_NAME}=;`),
  );
  assert.match(
    expiredCookie.headers["set-cookie"][0],
    new RegExp(`^${SESSION_COOKIE_NAME}=;`),
  );
});

test("does not request reset codes without a private reset secret", async () => {
  const model = fakeUserModel({ existingUser: createLoginUser() });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    emailConfig: { passwordResetSecret: "" },
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ana@example.com" });

  assert.equal(response.status, 503);
  assert.match(response.body.error, /temporarily unavailable/i);
  assert.equal(model.calls.findOne.length, 0);
});

test("sends a six-digit reset code but stores only its HMAC hash", async () => {
  const user = createLoginUser();
  const model = fakeUserModel({ existingUser: user });
  const sentEmails = [];
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    sendPasswordResetCode: async (message) => sentEmails.push(message),
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ANA@EXAMPLE.COM" });

  assert.equal(response.status, 202);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "ana@example.com");
  const [, code] = sentEmails[0].text.match(/code is (\d{6})/);
  assert.match(code, /^\d{6}$/);
  assert.equal(
    user.resetTokenHash,
    hashResetCode(code, testResetSecret),
  );
  assert.notEqual(user.resetTokenHash, code);
  assert.ok(user.resetTokenExpires > new Date());
  assert.ok(user.resetTokenExpires.getTime() <= Date.now() + 10 * 60 * 1000);
  assert.equal(user.resetCodeAttempts, 0);
  assert.match(sentEmails[0].html, new RegExp(code));
  assert.equal(JSON.stringify(response.body).includes(code), false);
});

test("returns the same recovery response for an unknown account", async () => {
  const sentEmails = [];
  const app = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
    sendPasswordResetCode: async (message) => sentEmails.push(message),
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "unknown@example.com" });

  assert.equal(response.status, 202);
  assert.deepEqual(response.body, {
    message: "If an active account matches that email, a verification code will be sent.",
  });
  assert.equal(sentEmails.length, 0);
});

test("clears a reset code when email delivery fails without revealing the account", async () => {
  const user = createLoginUser();
  const model = fakeUserModel({ existingUser: user });
  const app = createTestApp({
    UserModel: model,
    isDatabaseReady: () => true,
    sendPasswordResetCode: async () => {
      throw new Error("SMTP unavailable");
    },
  });

  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "ana@example.com" });

  assert.equal(response.status, 202);
  assert.deepEqual(response.body, {
    message: "If an active account matches that email, a verification code will be sent.",
  });
  assert.equal(model.calls.updateOne.length, 2);
  assert.equal("resetTokenHash" in user, false);
  assert.equal("resetTokenExpires" in user, false);
  assert.equal("resetCodeAttempts" in user, false);
});

test("verifies a reset code once and returns a scoped authorization cookie", async () => {
  const { app, user, code } = createResetCodeTestApp({ attempts: 2 });
  const response = await request(app)
    .post("/api/auth/verify-reset-code")
    .send({ email: " ANA@EXAMPLE.COM ", code });
  const reusedCodeResponse = await request(app)
    .post("/api/auth/verify-reset-code")
    .send({ email: "ana@example.com", code });
  const setCookie = response.headers["set-cookie"][0];
  const resetToken = setCookie
    .split(";")[0]
    .slice("bossgudo_password_reset=".length);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: "Verification successful." });
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api\/auth\/reset-password/i);
  assert.match(resetToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    user.resetTokenHash,
    crypto.createHash("sha256").update(resetToken).digest("hex"),
  );
  assert.equal("resetCodeAttempts" in user, false);
  assert.equal(JSON.stringify(response.body).includes(code), false);
  assert.equal(reusedCodeResponse.status, 400);
});

test("limits reset-code guesses and cleans up expired codes", async () => {
  const { app, user, model } = createResetCodeTestApp({ code: "123456" });
  const failures = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    failures.push(
      await request(app)
        .post("/api/auth/verify-reset-code")
        .send({ email: "ana@example.com", code: "000000" }),
    );
  }
  const expired = createResetCodeTestApp({
    expiresAt: new Date(Date.now() - 1),
  });
  const expiredResponse = await request(expired.app)
    .post("/api/auth/verify-reset-code")
    .send({ email: "ana@example.com", code: "012345" });

  assert.ok(failures.every((response) => response.status === 400));
  assert.equal(user.resetCodeAttempts, 5);
  assert.equal(model.calls.findOneAndUpdate.length, 5);
  assert.equal(expiredResponse.status, 400);
  assert.equal("resetTokenHash" in expired.user, false);
  assert.equal("resetTokenExpires" in expired.user, false);
});

test("does not distinguish unknown accounts from invalid reset codes", async () => {
  const unknownApp = createTestApp({
    UserModel: fakeUserModel(),
    isDatabaseReady: () => true,
  });
  const known = createResetCodeTestApp({ code: "123456" });
  const unknownResponse = await request(unknownApp)
    .post("/api/auth/verify-reset-code")
    .send({ email: "unknown@example.com", code: "123456" });
  const invalidResponse = await request(known.app)
    .post("/api/auth/verify-reset-code")
    .send({ email: "ana@example.com", code: "000000" });

  assert.equal(unknownResponse.status, invalidResponse.status);
  assert.deepEqual(unknownResponse.body, invalidResponse.body);
});

test("resets a password once and revokes existing sessions", async () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
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
    .set("Cookie", `${RESET_COOKIE_NAME}=${token}`)
    .send({
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const reusedTokenResponse = await request(app)
    .post("/api/auth/reset-password")
    .set("Cookie", `${RESET_COOKIE_NAME}=${token}`)
    .send({
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });

  assert.equal(response.status, 200);
  assert.equal(reusedTokenResponse.status, 400);
  assert.match(user.password, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await bcrypt.compare("NewStrongPass1!", user.password), true);
  assert.equal("resetTokenHash" in user, false);
  assert.equal("resetTokenExpires" in user, false);
  assert.equal("resetCodeAttempts" in user, false);
  assert.deepEqual(sessions.calls.deleteMany, [{ userId: "user-1" }]);
  assert.equal(model.calls.findOneAndUpdate[0].query.resetTokenHash, tokenHash);
  assert.ok(user.passwordChangedAt instanceof Date);
  assert.match(response.headers["set-cookie"][0], /Path=\/api\/auth\/reset-password/i);
  assert.match(response.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/i);
});

test("rejects expired and malformed reset tokens", async () => {
  const expiredToken = crypto.randomBytes(32).toString("base64url");
  const user = createLoginUser({
    resetTokenHash: hashResetToken(expiredToken),
    resetTokenExpires: new Date(Date.now() - 60_000),
  });
  const originalPassword = user.password;
  const app = createTestApp({
    UserModel: fakeUserModel({ existingUser: user }),
    SessionModel: fakeSessionModel(),
    isDatabaseReady: () => true,
  });

  const expired = await request(app)
    .post("/api/auth/reset-password")
    .set("Cookie", `${RESET_COOKIE_NAME}=${expiredToken}`)
    .send({
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const malformed = await request(app)
    .post("/api/auth/reset-password")
    .set("Cookie", `${RESET_COOKIE_NAME}=not-a-token`)
    .send({
      password: "NewStrongPass1!",
      confirmPassword: "NewStrongPass1!",
    });
  const tooLongPassword = await request(app)
    .post("/api/auth/reset-password")
    .set("Cookie", `${RESET_COOKIE_NAME}=${expiredToken}`)
    .send({
      password: `NewStrongPass1!${"x".repeat(70)}`,
      confirmPassword: `NewStrongPass1!${"x".repeat(70)}`,
    });

  assert.equal(expired.status, 400);
  assert.equal(malformed.status, 400);
  assert.equal(tooLongPassword.status, 400);
  assert.equal(user.password, originalPassword);
});
