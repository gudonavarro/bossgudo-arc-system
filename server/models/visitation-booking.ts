import { Schema, type Connection, type Model, type Types } from "mongoose";

const VISIT_TYPES = Object.freeze(["Regular", "Special"] as const);
const VISITATION_STATUSES = Object.freeze([
  "Booked",
  "Pending Review",
  "Approved",
  "Declined",
  "Completed",
  "Cancelled",
] as const);

export type VisitType = (typeof VISIT_TYPES)[number];
export type VisitationStatus = (typeof VISITATION_STATUSES)[number];

export interface VisitationStatusHistoryEntry {
  status: VisitationStatus;
  changedBy?: Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface VisitationBooking {
  customer_id: Types.ObjectId;
  reference: string;
  visitDate: Date;
  visitType: VisitType;
  specialRequestReason?: string;
  visitorCount: number;
  farmName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: VisitationStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  statusHistory: VisitationStatusHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

const visitationStatusHistorySchema = new Schema<VisitationStatusHistoryEntry>(
  {
    status: { type: String, enum: VISITATION_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const visitationBookingSchema = new Schema<VisitationBooking>(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: { type: String, required: true, trim: true, maxlength: 40 },
    visitDate: { type: Date, required: true },
    visitType: { type: String, enum: VISIT_TYPES, required: true },
    specialRequestReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      required(this: VisitationBooking) {
        return this.visitType === "Special";
      },
    },
    visitorCount: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Visitor count must be a whole number.",
      },
    },
    farmName: { type: String, trim: true, maxlength: 120, default: "" },
    customerName: { type: String, required: true, trim: true, maxlength: 161 },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    customerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    status: { type: String, enum: VISITATION_STATUSES, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    statusHistory: { type: [visitationStatusHistorySchema], default: [] },
  },
  { timestamps: true },
);

visitationBookingSchema.index({ reference: 1 }, { unique: true });
visitationBookingSchema.index({ customer_id: 1, createdAt: -1 });
visitationBookingSchema.index({ status: 1, visitDate: 1 });
visitationBookingSchema.index({ visitDate: 1 });

function getVisitationBookingModel(connection: Connection): Model<VisitationBooking> {
  return (
    (connection.models.VisitationBooking as Model<VisitationBooking> | undefined) ??
    connection.model<VisitationBooking>(
      "VisitationBooking",
      visitationBookingSchema,
      "visitation_bookings",
    )
  );
}

export { VISITATION_STATUSES, VISIT_TYPES, getVisitationBookingModel };
