import { Schema, Types, type Connection, type Model } from "mongoose";
import { isNonNegativeDecimal, toCents } from "../utils/money";

const SERVICE_TYPES = Object.freeze(["Pond Package", "Custom Pond Design"] as const);
const BOOKING_STATUSES = Object.freeze([
  "Pending",
  "Approved",
  "Rejected",
  "Confirmed",
  "Ongoing",
  "Completed",
  "Cancelled",
] as const);
const PAYMENT_STATUSES = Object.freeze([
  "Unpaid",
  "Verification Pending",
  "Partially Paid",
  "Paid",
  "Rejected",
] as const);

export type ServiceType = (typeof SERVICE_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface StatusHistoryEntry {
  status: BookingStatus;
  changedBy?: Types.ObjectId;
  changedAt: Date;
  note?: string;
}

/**
 * Copy of the catalog package at booking time. Later catalog edits or
 * deactivation never change it. Custom pond designs have no package.
 */
export interface PackageSnapshot {
  code: string;
  name: string;
  description: string;
  category: string;
  layers: string;
  dimensions: string;
  inclusions: string[];
  price: Types.Decimal128;
}

export interface ServiceBooking {
  customer_id: Types.ObjectId;
  reference: string;
  serviceType: ServiceType;
  packageSnapshot: PackageSnapshot | null;
  serviceDate: Date;
  serviceLocation: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  customConfiguration: unknown;
  customizationFee: Types.Decimal128;
  deliveryFee: Types.Decimal128;
  totalAmount: Types.Decimal128;
  depositAmount: Types.Decimal128;
  paidAmount: Types.Decimal128;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  deliveryFeeSetBy?: Types.ObjectId;
  deliveryFeeSetAt?: Date;
  statusHistory: StatusHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

const zeroAmount = () => Types.Decimal128.fromString("0.00");

const money = (options: { required?: boolean; default?: () => Types.Decimal128 } = {}) => ({
  type: Schema.Types.Decimal128,
  validate: {
    validator: isNonNegativeDecimal,
    message: "Monetary values must be non-negative.",
  },
  ...options,
});

const statusHistorySchema = new Schema<StatusHistoryEntry>(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const packageSnapshotSchema = new Schema<PackageSnapshot>(
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

const serviceBookingSchema = new Schema<ServiceBooking>(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: { type: String, required: true, trim: true, maxlength: 40 },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    // Required for "Pond Package" bookings, null for "Custom Pond Design".
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
    customConfiguration: { type: Schema.Types.Mixed, default: null },
    customizationFee: money({ default: zeroAmount }),
    deliveryFee: money({ default: zeroAmount }),
    totalAmount: money({ required: true }),
    depositAmount: money({ required: true }),
    paidAmount: money({ default: zeroAmount }),
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
    deliveryFeeSetBy: { type: Schema.Types.ObjectId, ref: "User" },
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
// saves the booking. The balance is not stored: it is always total - paid.
serviceBookingSchema.pre("validate", function () {
  if (this.serviceType === "Pond Package" && !this.packageSnapshot) {
    this.invalidate("packageSnapshot", "A package booking needs its package details.");
  }
  if (this.serviceType === "Custom Pond Design" && this.packageSnapshot) {
    this.invalidate("packageSnapshot", "A custom pond design has no catalog package.");
  }
  const packagePrice = this.packageSnapshot ? toCents(this.packageSnapshot.price) : 0;
  const customizationFee = toCents(this.customizationFee);
  const deliveryFee = toCents(this.deliveryFee);
  const total = toCents(this.totalAmount);
  const deposit = toCents(this.depositAmount);
  const paid = toCents(this.paidAmount);

  if (total !== packagePrice + customizationFee + deliveryFee) {
    this.invalidate("totalAmount", "Total amount does not match its components.");
  }
  if (deposit > total) {
    this.invalidate("depositAmount", "Deposit cannot exceed the total amount.");
  }
  if (paid > total) {
    this.invalidate("paidAmount", "Paid amount cannot exceed the total amount.");
  }
});

function getServiceBookingModel(connection: Connection): Model<ServiceBooking> {
  return (
    (connection.models.ServiceBooking as Model<ServiceBooking> | undefined) ??
    connection.model<ServiceBooking>("ServiceBooking", serviceBookingSchema, "service_bookings")
  );
}

export {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
  getServiceBookingModel,
};
