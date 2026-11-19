import mongoose from "mongoose";

const BOOKING_KINDS = Object.freeze(["service", "visit"]);
const AVAILABLE_DATE_STATUSES = Object.freeze(["Open", "Closed"]);

const availableDateSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    bookingKind: { type: String, enum: BOOKING_KINDS, required: true },
    status: { type: String, enum: AVAILABLE_DATE_STATUSES, required: true },
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

availableDateSchema.index({ date: 1, bookingKind: 1 }, { unique: true });
availableDateSchema.index({ bookingKind: 1, status: 1, date: 1 });

function getAvailableDateModel(connection) {
  return (
    connection.models.AvailableDate ??
    connection.model("AvailableDate", availableDateSchema, "available_dates")
  );
}

export { AVAILABLE_DATE_STATUSES, BOOKING_KINDS, getAvailableDateModel };
