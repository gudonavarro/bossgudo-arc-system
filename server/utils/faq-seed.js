import { createHash } from "node:crypto";
import mongoose from "mongoose";

const PRICING_QUESTION = "How much crayfish?";
const PRICING_KEYWORDS = [
  "crayfish",
  "craylings",
  "juvenile",
  "breeder",
  "breeder trio",
  "breeder quadro",
  "kilo order",
  "crayfish price",
  "crayfish cost",
  "price list",
];
const PRICING_ANSWER = [
  "Crayfish Prices:",
  "",
  "- Craylings (1–2 inches, 50 pcs): ₱1,300",
  "- Juvenile (2–3 inches, 25 pcs): ₱1,750",
  "- Breeder Trio (3–4 inches): ₱900",
  "- Breeder Trio (4–5 inches): ₱1,100",
  "- Breeder Quadro (3–4 inches): ₱1,200",
  "- Breeder Quadro (4–5 inches): ₱1,500",
  "- Kilo Order (4–5 inches, all male): ₱1,800",
  "- Kilo Order (4–5 inches, mixed gender): ₱2,500 (Minimum: 10 females)",
].join("\n");
const PRICING_FAQ_ID = new mongoose.Types.ObjectId(
  createHash("sha256")
    .update("bossgudo:faq:crayfish-pricing")
    .digest("hex")
    .slice(0, 24),
);
const SETUP_QUESTION = "How much setup?";
const SETUP_KEYWORDS = [
  "setup",
  "pond setup",
  "setup price",
  "setup cost",
  "how much setup",
  "PVC setup",
  "slotted angle bar setup",
  "pond package",
];
const SETUP_ANSWER =
  "You can view our available pond setups, package options, prices, and inclusions in our Shop. Click the View Setups link below to explore our available options.";
const SETUP_LINK = { label: "View Setups", href: "/shop" };
const SETUP_FAQ_ID = new mongoose.Types.ObjectId(
  createHash("sha256")
    .update("bossgudo:faq:pond-setup-pricing")
    .digest("hex")
    .slice(0, 24),
);

export async function seedCrayfishPricingFaq(FAQModel) {
  const timestamp = new Date();
  const result = await FAQModel.updateOne(
    {
      $or: [
        { _id: PRICING_FAQ_ID },
        { question: PRICING_QUESTION },
      ],
    },
    {
      $setOnInsert: {
        _id: PRICING_FAQ_ID,
        question: PRICING_QUESTION,
        keywords: PRICING_KEYWORDS,
        answer: PRICING_ANSWER,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    {
      upsert: true,
      runValidators: true,
      timestamps: false,
    },
  );
  return result.upsertedCount === 1;
}

export async function seedPondSetupFaq(FAQModel) {
  const timestamp = new Date();
  const result = await FAQModel.updateOne(
    {
      $or: [
        { _id: SETUP_FAQ_ID },
        { question: SETUP_QUESTION },
      ],
    },
    {
      $set: { active: true },
      $setOnInsert: {
        _id: SETUP_FAQ_ID,
        question: SETUP_QUESTION,
        keywords: SETUP_KEYWORDS,
        answer: SETUP_ANSWER,
        link: SETUP_LINK,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    {
      upsert: true,
      runValidators: true,
      timestamps: false,
    },
  );
  return result.upsertedCount === 1;
}

export {
  PRICING_ANSWER,
  PRICING_FAQ_ID,
  PRICING_KEYWORDS,
  PRICING_QUESTION,
  SETUP_ANSWER,
  SETUP_FAQ_ID,
  SETUP_KEYWORDS,
  SETUP_LINK,
  SETUP_QUESTION,
};
