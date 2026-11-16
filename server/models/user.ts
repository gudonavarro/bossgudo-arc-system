import { model, Schema, Types } from "mongoose";

export type UserRole = "customer" | "admin";
export type UserId = Types.ObjectId;

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s.]+$/;

const userSchema = new Schema<User>({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: EMAIL_PATTERN,
  },
  phoneNumber: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  isActive: { type: Boolean, default: true },
  resetTokenHash: { type: String },
  resetTokenExpires: { type: Date },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true });
userSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });

export const UserModel = model<User>("User", userSchema);
