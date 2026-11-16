const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { ObjectId } = require("mongodb");
const {
  clearSessionCookie,
  createSession,
  invalidateSession,
} = require("./session");
const {
  isPasswordResetMailConfigured,
  sendPasswordResetEmail,
} = require("./password-reset-mailer");
const {
  SESSION_COOKIE_NAME,
  createAuthenticationMiddleware,
} = require("./authenticate");

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s.]+$/;
const PHONE_PATTERN = /^(?:09|\+639)\d{9}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const DUMMY_BCRYPT_ROUNDS = 12;
const RESET_TOKEN_DURATION_MS = 30 * 60 * 1000;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PASSWORD_ERROR =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";

let dummyPasswordHashPromise;

function normalizePhoneNumber(value) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) {
    return `+63${compact.slice(1)}`;
  }
  return compact;
}

function getPasswordValidationError(password) {
  const hasRequiredLength =
    password.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES;
  const hasRequiredCharacters =
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password);

  if (!hasRequiredLength || !hasRequiredCharacters) {
    return PASSWORD_ERROR;
  }
  return null;
}

function getErrorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

function isDatabaseUnavailableError(error) {
  return [
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
    "MongoNotConnectedError",
    "MongoServerSelectionError",
    "MongoTopologyClosedError",
    "MongooseServerSelectionError",
  ].includes(getErrorName(error));
}

function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide registration details.", fieldErrors: {} };
  }

  const { firstName, lastName, email, phoneNumber, password, confirmPassword } =
    body;
  const fieldValues = {
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    confirmPassword,
  };
  const fieldErrors = {};
  for (const [field, value] of Object.entries(fieldValues)) {
    if (typeof value !== "string" || !value.trim()) {
      fieldErrors[field] = "This field is required.";
    }
  }
  const normalized = {
    firstName: typeof firstName === "string" ? firstName.trim() : "",
    lastName: typeof lastName === "string" ? lastName.trim() : "",
    email: typeof email === "string" ? email.trim().toLowerCase() : "",
    phoneNumber:
      typeof phoneNumber === "string"
        ? normalizePhoneNumber(phoneNumber.trim())
        : "",
  };

  if (!fieldErrors.firstName && normalized.firstName.length > 80) {
    fieldErrors.firstName = "Enter a first name of at most 80 characters.";
  }
  if (!fieldErrors.lastName && normalized.lastName.length > 80) {
    fieldErrors.lastName = "Enter a last name of at most 80 characters.";
  }
  if (
    !fieldErrors.email &&
    (normalized.email.length > 254 || !EMAIL_PATTERN.test(normalized.email))
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!fieldErrors.phoneNumber && !PHONE_PATTERN.test(normalized.phoneNumber)) {
    fieldErrors.phoneNumber = "Enter a valid PH number starting with 09 or +63.";
  }
  const passwordError =
    typeof password === "string" && password
      ? getPasswordValidationError(password)
      : null;
  if (!fieldErrors.password && passwordError) {
    fieldErrors.password = passwordError;
  }
  if (
    !fieldErrors.confirmPassword &&
    typeof password === "string" &&
    typeof confirmPassword === "string" &&
    password !== confirmPassword
  ) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: Object.values(fieldErrors)[0],
      fieldErrors,
    };
  }

  return {
    value: {
      ...normalized,
      password,
    },
  };
}

function validateLogin(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide your email and password." };
  }

  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Provide your email and password." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }
  if (!password || password.length > 1024) {
    return { error: "Enter a valid password." };
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return { error: "Password must not exceed 72 UTF-8 bytes." };
  }

  return { value: { email: normalizedEmail, password } };
}

function validatePasswordReset(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide a reset token and new password." };
  }
  const { token, password, confirmPassword } = body;
  if (
    typeof token !== "string" ||
    !RESET_TOKEN_PATTERN.test(token) ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { error: "Provide a valid reset token and password." };
  }
  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return { error: passwordError };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  return { value: { token, password } };
}

function compareAgainstDummyHash(password) {
  if (!dummyPasswordHashPromise) {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    dummyPasswordHashPromise = bcrypt.hash(randomPassword, DUMMY_BCRYPT_ROUNDS);
  }
  return dummyPasswordHashPromise.then((hash) => bcrypt.compare(password, hash));
}

function getCollections(request) {
  if (request.authCollections) {
    return request.authCollections;
  }
  const database = request.mongoDb;
  if (!database) {
    throw new Error("Database is unavailable.");
  }
  return {
    sessions: database.collection("sessions"),
    users: database.collection("users"),
  };
}

function asObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
    ? new ObjectId(value)
    : value;
}

function createAuthRouter({
  getCollections: getRequestCollections = getCollections,
  isDatabaseReady = (request) =>
    Boolean(request.authCollections || request.mongoDb),
  isProduction = () => process.env.NODE_ENV === "production",
  passwordResetMailConfigured = isPasswordResetMailConfigured,
  sendResetEmail = sendPasswordResetEmail,
} = {}) {
  const router = express.Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const recoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const authenticate = createAuthenticationMiddleware({
    getCollections: getRequestCollections,
    isDatabaseReady,
  });
  const authenticateIfPresent = createAuthenticationMiddleware({
    getCollections: getRequestCollections,
    isDatabaseReady,
    respondUnauthenticated: (_request, response) =>
      response.status(200).json({ user: null }),
  });
  const authenticateForLogout = createAuthenticationMiddleware({
    getCollections: getRequestCollections,
    isDatabaseReady,
    respondUnauthenticated: (_request, response) => {
      clearSessionCookie(response, isProduction());
      return response.status(200).json({ message: "Logged out." });
    },
  });

  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  const login = (requiredRole) => async (request, response) => {
    const validation = validateLogin(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Login is temporarily unavailable." });
    }

    try {
      const { users, sessions } = getRequestCollections(request);
      const user = await users.findOne(
        { email: validation.value.email },
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            password: 1,
            role: 1,
            isActive: 1,
          },
        },
      );
      const passwordMatches = user
        ? await bcrypt.compare(validation.value.password, user.password)
        : await compareAgainstDummyHash(validation.value.password);

      if (!user || !passwordMatches || !user.isActive || user.role !== requiredRole) {
        return response.status(401).json({ error: "Invalid email or password." });
      }

      const { token, expiresAt } = await createSession(
        sessions,
        user._id || user.id,
      );

      response.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "lax",
        path: "/",
        maxAge: expiresAt.getTime() - Date.now(),
      });

      return response.status(200).json({
        message: "Login successful.",
        user: {
          id: String(user._id || user.id),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login request failed:", getErrorName(error));
      return response
        .status(500)
        .json({ error: "Unable to log in right now." });
    }
  };

  router.post("/login", loginLimiter, login("customer"));
  router.post("/admin/login", loginLimiter, login("admin"));

  router.get("/me", authenticate, (request, response) => {
    return response.status(200).json({ user: request.authUser });
  });

  router.get("/session", authenticateIfPresent, (request, response) => {
    return response.status(200).json({ user: request.authUser });
  });

  router.post("/logout", authenticateForLogout, async (request, response) => {
    try {
      const { sessions } = getRequestCollections(request);
      await invalidateSession(sessions, asObjectId(request.authSessionId));
      clearSessionCookie(response, isProduction());
      return response.status(200).json({ message: "Logged out." });
    } catch (error) {
      console.error("Logout request failed:", getErrorName(error));
      return response.status(500).json({ error: "Unable to log out right now." });
    }
  });

  router.post("/forgot-password", recoveryLimiter, async (request, response) => {
    const email = request.body?.email;
    if (typeof email !== "string" || email.trim().length > 254 || !EMAIL_PATTERN.test(email.trim())) {
      return response.status(400).json({ error: "Enter a valid email address." });
    }
    if (!passwordResetMailConfigured()) {
      return response
        .status(503)
        .json({ error: "Password recovery email is not configured; no email was sent." });
    }
    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Password recovery is temporarily unavailable." });
    }

    let user;
    let resetTokenHash;
    try {
      const { users } = getRequestCollections(request);
      user = await users.findOne(
        { email: email.trim().toLowerCase(), isActive: true },
        { projection: { _id: 1, email: 1 } },
      );
      if (user) {
        const token = crypto.randomBytes(32).toString("base64url");
        resetTokenHash = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");
        await users.updateOne(
          { _id: user._id, isActive: true },
          {
            $set: {
              resetTokenHash,
              resetTokenExpires: new Date(Date.now() + RESET_TOKEN_DURATION_MS),
              updatedAt: new Date(),
            },
          },
        );
        await sendResetEmail({ to: user.email, token });
      }

      return response.status(202).json({
        message:
          "If an active account matches that email, password reset instructions will be sent.",
      });
    } catch (error) {
      if (user && resetTokenHash) {
        try {
          const { users } = getRequestCollections(request);
          await users.updateOne(
            { _id: user._id, resetTokenHash },
            { $unset: { resetTokenHash: "", resetTokenExpires: "" } },
          );
        } catch (cleanupError) {
          console.error(
            "Password reset token cleanup failed:",
            getErrorName(cleanupError),
          );
        }
      }
      console.error("Password reset request failed:", getErrorName(error));
      return response
        .status(503)
        .json({ error: "Unable to send password recovery instructions right now." });
    }
  });

  router.post("/reset-password", recoveryLimiter, async (request, response) => {
    const validation = validatePasswordReset(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }
    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Password recovery is temporarily unavailable." });
    }

    try {
      const { token, password } = validation.value;
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const passwordHash = await bcrypt.hash(password, 12);
      const { users, sessions } = getRequestCollections(request);
      const now = new Date();
      const user = await users.findOneAndUpdate(
        {
          resetTokenHash: tokenHash,
          resetTokenExpires: { $gt: new Date() },
          isActive: true,
        },
        {
          $set: {
            password: passwordHash,
            passwordChangedAt: now,
            updatedAt: now,
          },
          $unset: { resetTokenHash: "", resetTokenExpires: "" },
        },
        { projection: { _id: 1 }, returnDocument: "after" },
      );

      if (!user) {
        return response
          .status(400)
          .json({ error: "This password reset link is invalid or expired." });
      }
      await sessions.deleteMany({ userId: user._id });
      return response.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
      console.error("Password reset completion failed:", getErrorName(error));
      return response
        .status(500)
        .json({ error: "Unable to reset the password right now." });
    }
  });

  router.post("/register", registrationLimiter, async (request, response) => {
    const validation = validateRegistration(request.body);
    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
        fieldErrors: validation.fieldErrors,
      });
    }

    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Registration is temporarily unavailable." });
    }

    const { value } = validation;
    try {
      const { users } = getRequestCollections(request);
      const existingUser = await users.findOne(
        {
          $or: [{ email: value.email }, { phoneNumber: value.phoneNumber }],
        },
        { projection: { _id: 1, email: 1, phoneNumber: 1 } },
      );
      if (existingUser) {
        const fieldErrors = {};
        if (existingUser.email === value.email) {
          fieldErrors.email = "An account with this email already exists.";
        }
        if (existingUser.phoneNumber === value.phoneNumber) {
          fieldErrors.phoneNumber = "This phone number is already registered.";
        }
        return response.status(409).json({
          error: "An account with those details already exists.",
          fieldErrors,
        });
      }

      const now = new Date();
      const user = {
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phoneNumber: value.phoneNumber,
        password: value.password,
        role: "customer",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const result = await users.insertOne(user);

      return response.status(201).json({
        message: "Account created.",
        user: {
          id: String(result.insertedId),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      });
    } catch (error) {
      if (error?.code === 11000) {
        const fieldErrors = {};
        if (error.keyPattern?.email) {
          fieldErrors.email = "An account with this email already exists.";
        }
        if (error.keyPattern?.phoneNumber) {
          fieldErrors.phoneNumber = "This phone number is already registered.";
        }
        return response.status(409).json({
          error: "An account with those details already exists.",
          fieldErrors,
        });
      }
      if (error?.name === "ValidationError") {
        const fieldMessages = {
          firstName: "Enter a valid first name.",
          lastName: "Enter a valid last name.",
          email: "Enter a valid email address.",
          phoneNumber: "Enter a valid PH phone number.",
          password: "Enter a valid password.",
        };
        const fieldErrors = {};
        for (const [field, message] of Object.entries(fieldMessages)) {
          if (error.errors?.[field]) {
            fieldErrors[field] = message;
          }
        }
        return response.status(400).json({
          error: "Please check your registration details.",
          fieldErrors,
        });
      }
      if (isDatabaseUnavailableError(error)) {
        console.error("Registration database unavailable:", getErrorName(error));
        return response
          .status(503)
          .json({ error: "Registration is temporarily unavailable." });
      }
      console.error("Registration request failed:", getErrorName(error));
      return response
        .status(500)
        .json({ error: "Unable to create the account right now." });
    }
  });

  return router;
}

module.exports = { createAuthRouter, validateLogin, validateRegistration };
