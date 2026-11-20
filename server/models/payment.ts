import { Schema, type Connection, type Model, type Types } from "mongoose";
import { toCents, type MoneyValue } from "../utils/money";

const PAYMENT_TARGETS = Object.freeze(["deposit", "balance"] as const);
const PAYMENT_RECORD_STATUSES = Object.freeze(["Pending", "Verified", "Rejected"] as const);

export type PaymentTarget = (typeof PAYMENT_TARGETS)[number];
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export interface Payment {
  service_booking_id: Types.ObjectId;
  paymentTarget: PaymentTarget;
  amount: Types.Decimal128;
  expectedAmount: Types.Decimal128;
  gcashReference: string;
  receiptFileName: string;
  receiptStorageKey: string;
  status: PaymentRecordStatus;
  submittedAt: Date;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const positiveMoney = {
  type: Schema.Types.Decimal128,
  required: true,
  validate: {
    validator(value: unknown) {
      try {
        return toCents(value as MoneyValue) > 0;
      } catch {
        return false;
      }
    },
    message: "Payment amounts must be greater than zero.",
  },
};

const paymentSchema = new Schema<Payment>(
  {
    service_booking_id: {
      type: Schema.Types.ObjectId,
      ref: "ServiceBooking",
      required: true,
    },
    paymentTarget: { type: String, enum: PAYMENT_TARGETS, required: true },
    amount: positiveMoney,
    expectedAmount: positiveMoney,
    // GCash is the only payment method, so every payment has a GCash reference.
    gcashReference: { type: String, required: true, trim: true, maxlength: 64 },
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
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

function getPaymentModel(connection: Connection): Model<Payment> {
  return (
    (connection.models.Payment as Model<Payment> | undefined) ??
    connection.model<Payment>("Payment", paymentSchema, "payments")
  );
}

export {
  PAYMENT_RECORD_STATUSES,
  PAYMENT_TARGETS,
  getPaymentModel,
};
