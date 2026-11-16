const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { ObjectId } = require("mongodb");
const path = require("node:path");
const serverUtilsPath = (fileName) =>
  path.resolve(process.cwd(), "server", "utils", fileName);
const {
  clearSessionCookie,
  createSession,
  invalidateSession,
} = require(serverUtilsPath("session.js"));
const {
  SESSION_COOKIE_NAME,
  createAuthenticationMiddleware,
} = require(serverUtilsPath("authenticate.js"));
const { isValidEmailAddress, sendEmail } = require(
  serverUtilsPath("email-mailer.js"),
);
const {
  createResetCode,
  createResetCodeEmail,
  hashResetCode,
  hashResetToken,
  isResetSecretConfigured,
  matchesResetCodeHash,
  readResetToken,
  RESET_COOKIE_NAME,
} = require(serverUtilsPath("password-reset.js"));

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s.]+$/;
const PHONE_PATTERN = /^(?:09|\+639)\d{9}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const DUMMY_BCRYPT_ROUNDS = 12;
const RESET_CODE_DURATION_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_PATTERN = /^\d{6}$/;
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an active account matches that email, a verification code will be sent.";
const INVALID_RESET_CODE_MESSAGE = "Invalid or expired verification code.";
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

function getRequiredRegistrationFieldErrors(fieldValues) {
  const fieldErrors = {};
  for (const [field, value] of Object.entries(fieldValues)) {
    if (typeof value !== "string" || !value.trim()) {
      fieldErrors[field] = "This field is required.";
    }
  }
  return fieldErrors;
}

function normalizeRegistrationFields({ firstName, lastName, email, phoneNumber }) {
  return {
    firstName: typeof firstName === "string" ? firstName.trim() : "",
    lastName: typeof lastName === "string" ? lastName.trim() : "",
    email: typeof email === "string" ? email.trim().toLowerCase() : "",
    phoneNumber:
      typeof phoneNumber === "string"
        ? normalizePhoneNumber(phoneNumber.trim())
        : "",
  };
}

function validateRegistrationNames(normalized, fieldErrors) {
  if (!fieldErrors.firstName && normalized.firstName.length > 80) {
    fieldErrors.firstName = "Enter a first name of at most 80 characters.";
  }
  if (!fieldErrors.lastName && normalized.lastName.length > 80) {
    fieldErrors.lastName = "Enter a last name of at most 80 characters.";
  }
}

function validateRegistrationContact(normalized, fieldErrors) {
  if (
    !fieldErrors.email &&
    (normalized.email.length > 254 || !EMAIL_PATTERN.test(normalized.email))
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!fieldErrors.phoneNumber && !PHONE_PATTERN.test(normalized.phoneNumber)) {
    fieldErrors.phoneNumber = "Enter a valid PH number starting with 09 or +63.";
  }
}

function validateRegistrationPasswords(password, confirmPassword, fieldErrors) {
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
}

function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide registration details.", fieldErrors: {} };
  }

  const { firstName, lastName, email, phoneNumber, password, confirmPassword } =
    body;
  const fieldErrors = getRequiredRegistrationFieldErrors({
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    confirmPassword,
  });
  const normalized = normalizeRegistrationFields({
    firstName,
    lastName,
    email,
    phoneNumber,
  });
  validateRegistrationNames(normalized, fieldErrors);
  validateRegistrationContact(normalized, fieldErrors);
  validateRegistrationPasswords(password, confirmPassword, fieldErrors);

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
    return { error: "Provide a new password and confirmation." };
  }
  const { password, confirmPassword } = body;
  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { error: "Provide a new password and confirmation." };
  }
  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return { error: passwordError };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  return { value: { password } };
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

function getPasswordResetSecret(request, isDatabaseReady) {
  if (!isDatabaseReady(request)) {
    return null;
  }
  const secret = request.emailConfig?.passwordResetSecret;
  return isResetSecretConfigured(secret) ? secret : null;
}

function asObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
    ? new ObjectId(value)
    : value;
}

function getDuplicateRegistrationFieldErrors(user, registration) {
  const fieldErrors = {};
  if (user.email === registration.email) {
    fieldErrors.email = "An account with this email already exists.";
  }
  if (user.phoneNumber === registration.phoneNumber) {
    fieldErrors.phoneNumber = "This phone number is already registered.";
  }
  return fieldErrors;
}

function getDuplicateKeyFieldErrors(error) {
  const fieldErrors = {};
  if (error.keyPattern?.email) {
    fieldErrors.email = "An account with this email already exists.";
  }
  if (error.keyPattern?.phoneNumber) {
    fieldErrors.phoneNumber = "This phone number is already registered.";
  }
  return fieldErrors;
}

function getMongooseRegistrationFieldErrors(error) {
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
  return fieldErrors;
}

function sendRegistrationConflict(response, fieldErrors) {
  return response.status(409).json({
    error: "An account with those details already exists.",
    fieldErrors,
  });
}

function handleRegistrationError(error, response) {
  if (error?.code === 11000) {
    return sendRegistrationConflict(response, getDuplicateKeyFieldErrors(error));
  }
  if (error?.name === "ValidationError") {
    return response.status(400).json({
      error: "Please check your registration details.",
      fieldErrors: getMongooseRegistrationFieldErrors(error),
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

function createRegistrationHandler({ getCollections, isDatabaseReady }) {
  return async (request, response) => {
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
      const { users } = getCollections(request);
      const existingUser = await users.findOne(
        {
          $or: [{ email: value.email }, { phoneNumber: value.phoneNumber }],
        },
        { projection: { _id: 1, email: 1, phoneNumber: 1 } },
      );
      if (existingUser) {
        return sendRegistrationConflict(
          response,
          getDuplicateRegistrationFieldErrors(existingUser, value),
        );
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
      return handleRegistrationError(error, response);
    }
  };
}

function createAuthRouter({
  getCollections: getRequestCollections = getCollections,
  isDatabaseReady = (request) =>
    Boolean(request.authCollections || request.mongoDb),
  isProduction = () => process.env.NODE_ENV === "production",
  sendTestEmail = sendEmail,
  sendPasswordResetCode = sendEmail,
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
  const resetCodeVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const emailTestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const authenticate = createAuthenticationMiddleware({
    getCollections: getRequestCollections,
    isDatabaseReady,
  });
  const authenticateAdmin = createAuthenticationMiddleware({
    getCollections: getRequestCollections,
    isDatabaseReady,
    requiredRole: "admin",
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

  router.post(
    "/admin/email-test",
    (request, response, next) => {
      if (isProduction()) {
        return response.status(404).json({ error: "Not found." });
      }
      return next();
    },
    emailTestLimiter,
    authenticateAdmin,
    async (request, response) => {
      const to = request.body?.to;
      if (!isValidEmailAddress(to)) {
        return response
          .status(400)
          .json({ error: "Enter a valid recipient email address." });
      }

      try {
        await sendTestEmail(
          {
            to,
            subject: "BOSSGUDO SMTP email test",
            text: "This is a test email from the BOSSGUDO A.R.C. Aqua Farm server.",
            html: "<p>This is a test email from the BOSSGUDO A.R.C. Aqua Farm server.</p>",
          },
          request.emailConfig,
        );
        return response.status(200).json({ message: "Test email sent." });
      } catch (error) {
        console.error("Email test failed:", getErrorName(error));
        return response
          .status(503)
          .json({ error: "Unable to send test email." });
      }
    },
  );

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
    if (!isValidEmailAddress(email)) {
      return response.status(400).json({ error: "Enter a valid email address." });
    }
    const resetSecret = getPasswordResetSecret(request, isDatabaseReady);
    if (resetSecret === null) {
      return response
        .status(503)
        .json({ error: "Password recovery is temporarily unavailable." });
    }

    let user;
    let resetCodeHash;
    let resetCodeExpiresAt;
    try {
      const { users } = getRequestCollections(request);
      user = await users.findOne(
        { email: email.trim().toLowerCase(), isActive: true },
        { projection: { _id: 1, email: 1 } },
      );
      if (user) {
        const code = createResetCode();
        resetCodeHash = hashResetCode(code, resetSecret, String(user._id));
        const now = new Date();
        resetCodeExpiresAt = new Date(now.getTime() + RESET_CODE_DURATION_MS);
        await users.updateOne(
          { _id: user._id, isActive: true },
          {
            $set: {
              resetTokenHash: resetCodeHash,
              resetTokenExpires: resetCodeExpiresAt,
              resetCodeAttempts: 0,
              updatedAt: now,
            },
          },
        );
        await sendPasswordResetCode(
          { to: user.email, ...createResetCodeEmail(code) },
          request.emailConfig,
        );
      }

      return response.status(202).json({
        message: PASSWORD_RESET_REQUEST_MESSAGE,
      });
    } catch (error) {
      if (user && resetCodeHash) {
        try {
          const { users } = getRequestCollections(request);
          await users.updateOne(
            {
              _id: user._id,
              resetTokenHash: resetCodeHash,
              resetTokenExpires: resetCodeExpiresAt,
            },
            {
              $unset: {
                resetTokenHash: "",
                resetTokenExpires: "",
                resetCodeAttempts: "",
              },
            },
          );
        } catch (cleanupError) {
          console.error(
            "Password reset code cleanup failed:",
            getErrorName(cleanupError),
          );
        }
      }
      console.error("Password reset code request failed:", getErrorName(error));
      if (isDatabaseUnavailableError(error)) {
        return response
          .status(503)
          .json({ error: "Password recovery is temporarily unavailable." });
      }
      return response.status(202).json({
        message: PASSWORD_RESET_REQUEST_MESSAGE,
      });
    }
  });

  router.post(
    "/verify-reset-code",
    resetCodeVerificationLimiter,
    async (request, response) => {
      const { email, code } = request.body ?? {};
      if (
        !isValidEmailAddress(email) ||
        typeof code !== "string" ||
        !RESET_CODE_PATTERN.test(code)
      ) {
        return response
          .status(400)
          .json({ error: "Enter a valid email address and 6-digit code." });
      }
      const resetSecret = getPasswordResetSecret(request, isDatabaseReady);
      if (resetSecret === null) {
        return response
          .status(503)
          .json({ error: "Password recovery is temporarily unavailable." });
      }

      try {
        const { users } = getRequestCollections(request);
        const now = new Date();
        const user = await users.findOne(
          { email: email.trim().toLowerCase(), isActive: true },
          {
            projection: {
              _id: 1,
              resetTokenHash: 1,
              resetTokenExpires: 1,
              resetCodeAttempts: 1,
            },
          },
        );
        if (
          !user ||
          !(user.resetTokenExpires instanceof Date) ||
          user.resetTokenExpires <= now ||
          typeof user.resetCodeAttempts !== "number" ||
          user.resetCodeAttempts >= RESET_CODE_MAX_ATTEMPTS
        ) {
          if (user && user.resetTokenExpires instanceof Date && user.resetTokenExpires <= now) {
            await users.updateOne(
              {
                _id: user._id,
                resetTokenHash: user.resetTokenHash,
                resetTokenExpires: user.resetTokenExpires,
              },
              {
                $unset: {
                  resetTokenHash: "",
                  resetTokenExpires: "",
                  resetCodeAttempts: "",
                },
              },
            );
          }
          return response
            .status(400)
            .json({ error: INVALID_RESET_CODE_MESSAGE });
        }

        const submittedHash = hashResetCode(
          code,
          resetSecret,
          String(user._id),
        );
        if (!matchesResetCodeHash(user.resetTokenHash, submittedHash)) {
          await users.findOneAndUpdate(
            {
              _id: user._id,
              resetTokenHash: user.resetTokenHash,
              resetTokenExpires: { $gt: now },
              resetCodeAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
            },
            { $inc: { resetCodeAttempts: 1 } },
            { projection: { _id: 1 }, returnDocument: "after" },
          );
          return response
            .status(400)
            .json({ error: INVALID_RESET_CODE_MESSAGE });
        }

        const resetToken = crypto.randomBytes(32).toString("base64url");
        const resetAuthorization = await users.findOneAndUpdate(
          {
            _id: user._id,
            resetTokenHash: user.resetTokenHash,
            resetTokenExpires: { $gt: now },
            resetCodeAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
          },
          {
            $set: {
              resetTokenHash: hashResetToken(resetToken),
              updatedAt: now,
            },
            $unset: { resetCodeAttempts: "" },
          },
          {
            projection: { _id: 1, resetTokenExpires: 1 },
            returnDocument: "after",
          },
        );
        if (!resetAuthorization) {
          return response
            .status(400)
            .json({ error: INVALID_RESET_CODE_MESSAGE });
        }

        response.cookie(RESET_COOKIE_NAME, resetToken, {
          httpOnly: true,
          secure: isProduction(),
          sameSite: "lax",
          path: "/api/auth/reset-password",
          maxAge: resetAuthorization.resetTokenExpires.getTime() - now.getTime(),
        });
        return response.status(200).json({ message: "Verification successful." });
      } catch (error) {
        console.error("Password reset code verification failed:", getErrorName(error));
        return response
          .status(503)
          .json({ error: "Password recovery is temporarily unavailable." });
      }
    },
  );

  router.post("/reset-password", recoveryLimiter, async (request, response) => {
    const validation = validatePasswordReset(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }
    const resetToken = readResetToken(request);
    if (!resetToken) {
      return response
        .status(400)
        .json({ error: "Reset authorization is invalid or expired." });
    }
    if (!isDatabaseReady(request)) {
      return response
        .status(503)
        .json({ error: "Password recovery is temporarily unavailable." });
    }

    try {
      const { password } = validation.value;
      const tokenHash = hashResetToken(resetToken);
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
          $unset: {
            resetTokenHash: "",
            resetTokenExpires: "",
            resetCodeAttempts: "",
          },
        },
        { projection: { _id: 1 }, returnDocument: "after" },
      );

      if (!user) {
        await users.updateOne(
          {
            resetTokenHash: tokenHash,
            resetTokenExpires: { $lte: now },
          },
          {
            $unset: {
              resetTokenHash: "",
              resetTokenExpires: "",
              resetCodeAttempts: "",
            },
          },
        );
        response.clearCookie(RESET_COOKIE_NAME, {
          httpOnly: true,
          secure: isProduction(),
          sameSite: "lax",
          path: "/api/auth/reset-password",
        });
        return response
          .status(400)
          .json({ error: "Reset authorization is invalid or expired." });
      }
      await sessions.deleteMany({ userId: user._id });
      response.clearCookie(RESET_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "lax",
        path: "/api/auth/reset-password",
      });
      return response.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
      console.error("Password reset completion failed:", getErrorName(error));
      return response
        .status(500)
        .json({ error: "Unable to reset the password right now." });
    }
  });

  router.post(
    "/register",
    registrationLimiter,
    createRegistrationHandler({
      getCollections: getRequestCollections,
      isDatabaseReady,
    }),
  );

  return router;
}

module.exports = { createAuthRouter, validateLogin, validateRegistration };
