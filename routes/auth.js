const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:09\d{9}|\+639\d{9})$/;
const PASSWORD_MIN_LENGTH = 8;

function normalizePhoneNumber(value) {
  const compact = value.replace(/[\s()-]/g, "");
  return /^09\d{9}$/.test(compact)
    ? `+63${compact.slice(1)}`
    : compact;
}

function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide registration details." };
  }

  const { firstName, lastName, email, phoneNumber, password, confirmPassword } =
    body;
  const stringFields = [firstName, lastName, email, phoneNumber, password, confirmPassword];
  if (stringFields.some((value) => typeof value !== "string")) {
    return { error: "Complete all required fields." };
  }

  const normalized = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: normalizePhoneNumber(phoneNumber.trim()),
  };

  if (
    !normalized.firstName ||
    normalized.firstName.length > 80 ||
    !normalized.lastName ||
    normalized.lastName.length > 80
  ) {
    return { error: "Enter a first and last name of at most 80 characters." };
  }
  if (normalized.email.length > 254 || !EMAIL_PATTERN.test(normalized.email)) {
    return { error: "Enter a valid email address." };
  }
  if (!PHONE_PATTERN.test(normalized.phoneNumber)) {
    return { error: "Enter a valid PH number starting with 09 or +63." };
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  ) {
    return {
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
    };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  return {
    value: {
      ...normalized,
      password,
    },
  };
}

function createAuthRouter({
  UserModel = User,
  isDatabaseReady = () => mongoose.connection.readyState === 1,
} = {}) {
  const router = express.Router();

  router.post("/register", async (request, response) => {
    const validation = validateRegistration(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    if (!isDatabaseReady()) {
      return response
        .status(503)
        .json({ error: "Registration is temporarily unavailable." });
    }

    const { value } = validation;
    try {
      const existingUser = await UserModel.findOne({
        $or: [
          { email: value.email },
          { phoneNumber: value.phoneNumber },
        ],
      })
        .select("_id")
        .lean();
      if (existingUser) {
        return response
          .status(409)
          .json({ error: "An account with those details already exists." });
      }

      const user = await UserModel.create({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phoneNumber: value.phoneNumber,
        password: value.password,
        role: "customer",
      });

      return response.status(201).json({
        message: "Account created.",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      });
    } catch (error) {
      if (error?.code === 11000) {
        return response
          .status(409)
          .json({ error: "An account with those details already exists." });
      }
      if (error instanceof mongoose.Error.ValidationError) {
        return response
          .status(400)
          .json({ error: "Registration details are invalid." });
      }

      console.error("Registration request failed:", error?.name || "Error");
      return response
        .status(500)
        .json({ error: "Unable to create the account right now." });
    }
  });

  return router;
}

module.exports = { createAuthRouter, validateRegistration };
