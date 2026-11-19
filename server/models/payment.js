import mongoose from "mongoose";
import { toCents } from "../utils/money.js";

const PAYMENT_TARGETS = Object.freeze(["deposit", "balance"]);
const PAYMENT_METHODS = Object.freeze(["GCash"]);
const PAYMENT_RECORD_STATUSES = Object.freeze(["Pending", "Verified", "Rejected"]);

const positiveMoney = {
  type: mongoose.Schema.Types.Decimal128,
  required: true,
  validate: {
    validator(value) {
      try {
        return toCents(value) > 0;
      } catch {
        return false;
      }
    },
    message: "Payment amounts must be greater than zero.",
  },
};

const paymentSchema = new mongoose.Schema(
  {
    service_booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceBooking",
      required: true,
    },
    paymentTarget: { type: String, enum: PAYMENT_TARGETS, required: true },
    amount: positiveMoney,
    expectedAmount: positiveMoney,
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    gcashReference: { type: String, trim: true, maxlength: 64 },
    receiptFileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    receiptStorageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
    },
    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUSES,
      required: true,
      default: "Pending",
    },
    submittedAt: { type: Date, required: true, default: Date.now },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

paymentSchema.index({ service_booking_id: 1, submittedAt: -1 });
paymentSchema.index({ status: 1, submittedAt: -1 });
paymentSchema.index({ gcashReference: 1 }, { sparse: true });
// Only one payment per booking may await verification at a time. This
// blocks duplicate submissions from repeated requests at the database level.
paymentSchema.index(
  { service_booking_id: 1 },
  {
    name: "one_pending_payment_per_booking",
    unique: true,
    partialFilterExpression: { status: "Pending" },
  },
);

function getPaymentModel(connection) {
  return (
    connection.models.Payment ??
    connection.model("Payment", paymentSchema, "payments")
  );
}

export {
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_TARGETS,
  getPaymentModel,
};
