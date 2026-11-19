import mongoose from "mongoose";
import { isNonNegativeDecimal, toCents } from "../utils/money.js";

const SERVICE_TYPES = Object.freeze(["Pond Package", "Custom Pond Design"]);
const BOOKING_STATUSES = Object.freeze([
  "Pending",
  "Approved",
  "Rejected",
  "Confirmed",
  "Ongoing",
  "Completed",
  "Cancelled",
]);
const PAYMENT_STATUSES = Object.freeze([
  "Unpaid",
  "Verification Pending",
  "Partially Paid",
  "Paid",
  "Rejected",
]);

const money = (options = {}) => ({
  type: mongoose.Schema.Types.Decimal128,
  validate: {
    validator: isNonNegativeDecimal,
    message: "Monetary values must be non-negative.",
  },
  ...options,
});

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

/**
 * Copy of the catalog package at booking time. Later catalog edits or
 * deactivation never change it. Custom pond designs have no package.
 */
const packageSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "Pond Package" },
    layers: { type: String, trim: true, default: "" },
    dimensions: { type: String, trim: true, default: "" },
    inclusions: { type: [String], default: [] },
    price: money({ required: true }),
  },
  { _id: false },
);

const serviceBookingSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: { type: String, required: true, trim: true, maxlength: 40 },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    packageNameSnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    packagePrice: money({ required: true }),
    packageSnapshot: { type: packageSnapshotSchema, default: null },
    serviceDate: { type: Date, required: true },
    serviceLocation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 161 },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    customerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    customConfiguration: { type: mongoose.Schema.Types.Mixed, default: null },
    customizationFee: money({ default: () => mongoose.Types.Decimal128.fromString("0.00") }),
    deliveryFee: money({ default: () => mongoose.Types.Decimal128.fromString("0.00") }),
    totalAmount: money({ required: true }),
    depositAmount: money({ required: true }),
    paidAmount: money({ default: () => mongoose.Types.Decimal128.fromString("0.00") }),
    balanceAmount: money({ required: true }),
    bookingStatus: {
      type: String,
      enum: BOOKING_STATUSES,
      required: true,
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: "Unpaid",
    },
    deliveryFeeSetBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deliveryFeeSetAt: { type: Date },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true },
);

serviceBookingSchema.index({ reference: 1 }, { unique: true });
serviceBookingSchema.index({ customer_id: 1, createdAt: -1 });
serviceBookingSchema.index({ bookingStatus: 1, createdAt: -1 });
serviceBookingSchema.index({ paymentStatus: 1, createdAt: -1 });
serviceBookingSchema.index({ serviceDate: 1 });

// Keeps the stored amounts internally consistent no matter which code path
// saves the booking.
serviceBookingSchema.pre("validate", function () {
  const packagePrice = toCents(this.packagePrice);
  const customizationFee = toCents(this.customizationFee);
  const deliveryFee = toCents(this.deliveryFee);
  const total = toCents(this.totalAmount);
  const deposit = toCents(this.depositAmount);
  const paid = toCents(this.paidAmount);
  const balance = toCents(this.balanceAmount);

  if (total !== packagePrice + customizationFee + deliveryFee) {
    this.invalidate("totalAmount", "Total amount does not match its components.");
  }
  if (deposit > total) {
    this.invalidate("depositAmount", "Deposit cannot exceed the total amount.");
  }
  if (paid > total) {
    this.invalidate("paidAmount", "Paid amount cannot exceed the total amount.");
  }
  if (balance !== total - paid) {
    this.invalidate("balanceAmount", "Balance does not match total minus paid.");
  }
});

function getServiceBookingModel(connection) {
  return (
    connection.models.ServiceBooking ??
    connection.model("ServiceBooking", serviceBookingSchema, "service_bookings")
  );
}

export {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
  getServiceBookingModel,
};
