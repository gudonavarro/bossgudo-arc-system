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

const userSchema = new Schema<User>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  isActive: { type: Boolean, default: true },
  resetTokenHash: { type: String },
  resetTokenExpires: { type: Date },
});

export const UserModel = model<User>("User", userSchema);
