import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  keywords: {
    type: [{ type: String, trim: true }],
    required: true,
    validate: {
      validator: (keywords) => keywords.length > 0,
      message: "At least one keyword is required.",
    },
  },
  answer: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export function getFaqModel(connection) {
  return (
    connection.models.FAQ ??
    connection.model("FAQ", faqSchema, "faqs")
  );
}
