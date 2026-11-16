import mongoose from "mongoose";

const faqLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    href: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  keywords: {
    type: [{ type: String, trim: true }],
    required: true,
    validate: {
      validator: (keywords) =>
        keywords.length > 0 && keywords.every((keyword) => keyword.length > 0),
      message: "At least one non-empty keyword is required.",
    },
  },
  answer: { type: String, required: true, trim: true },
  link: { type: faqLinkSchema, default: null },
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
