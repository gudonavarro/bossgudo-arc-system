const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const BCRYPT_ROUNDS = 12;

function normalizePhoneNumber(phoneNumber) {
  const compact = String(phoneNumber ?? "").replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) {
    return `+63${compact.slice(1)}`;
  }
  return compact;
}

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      set: normalizePhoneNumber,
    },
    password: {
      type: String,
      required: true,
      select: false,
      validate: {
        validator: (value) => BCRYPT_HASH_PATTERN.test(value),
        message: "Password must be stored as a bcrypt hash.",
      },
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      immutable: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, result) {
        delete result.password;
        delete result.resetTokenHash;
        delete result.resetTokenExpires;
        return result;
      },
    },
  },
);

userSchema.pre("validate", async function hashPasswordBeforeValidation() {
  if (
    !this.isModified("password") ||
    typeof this.password !== "string" ||
    !this.password ||
    this.$locals.hashedPassword === this.password
  ) {
    return;
  }
  const password = this.password;
  this.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  this.$locals.hashedPassword = this.password;
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);
