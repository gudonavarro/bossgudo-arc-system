import { Schema, type Connection, type Model, type Types } from "mongoose";

const BOOKING_KINDS = Object.freeze(["service", "visit"] as const);
const AVAILABLE_DATE_STATUSES = Object.freeze(["Open", "Closed"] as const);

export type BookingKind = (typeof BOOKING_KINDS)[number];
export type AvailableDateStatus = (typeof AVAILABLE_DATE_STATUSES)[number];

export interface AvailableDate {
  date: Date;
  bookingKind: BookingKind;
  status: AvailableDateStatus;
  reason: string;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const availableDateSchema = new Schema<AvailableDate>(
  {
    date: { type: Date, required: true },
    bookingKind: { type: String, enum: BOOKING_KINDS, required: true },
    status: { type: String, enum: AVAILABLE_DATE_STATUSES, required: true },
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

availableDateSchema.index({ date: 1, bookingKind: 1 }, { unique: true });
availableDateSchema.index({ bookingKind: 1, status: 1, date: 1 });

function getAvailableDateModel(connection: Connection): Model<AvailableDate> {
  return (
    (connection.models.AvailableDate as Model<AvailableDate> | undefined) ??
    connection.model<AvailableDate>("AvailableDate", availableDateSchema, "available_dates")
  );
}

export { AVAILABLE_DATE_STATUSES, BOOKING_KINDS, getAvailableDateModel };
