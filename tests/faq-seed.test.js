const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  CONTACT_ANSWER,
  CONTACT_FAQ_ID,
  CONTACT_KEYWORDS,
  CONTACT_QUESTION,
  PRICING_ANSWER,
  PRICING_FAQ_ID,
  PRICING_KEYWORDS,
  PRICING_QUESTION,
  SETUP_ANSWER,
  SETUP_FAQ_ID,
  SETUP_KEYWORDS,
  SETUP_LINK,
  SETUP_QUESTION,
  seedCrayfishPricingFaq,
  seedContactLocationFaq,
  seedPondSetupFaq,
} = jiti("../server/utils/faq-seed.js");

test("seeds the initial pricing FAQ only when it is absent", async () => {
  const calls = [];
  let inserted = false;
  const model = {
    async updateOne(filter, update, options) {
      calls.push({ filter, update, options });
      if (inserted) {
        return { upsertedCount: 0 };
      }
      inserted = true;
      return { upsertedCount: 1 };
    },
  };

  assert.equal(await seedCrayfishPricingFaq(model), true);
  assert.equal(await seedCrayfishPricingFaq(model), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].filter, {
    $or: [
      { _id: PRICING_FAQ_ID },
      { question: PRICING_QUESTION },
    ],
  });
  assert.deepEqual(calls[0].update, {
    $setOnInsert: {
      _id: PRICING_FAQ_ID,
      question: PRICING_QUESTION,
      keywords: PRICING_KEYWORDS,
      answer: PRICING_ANSWER,
      active: true,
      createdAt: calls[0].update.$setOnInsert.createdAt,
      updatedAt: calls[0].update.$setOnInsert.updatedAt,
    },
  });
  assert.equal(
    calls[0].update.$setOnInsert.createdAt,
    calls[0].update.$setOnInsert.updatedAt,
  );
  assert.deepEqual(calls[0].options, {
    upsert: true,
    runValidators: true,
    timestamps: false,
  });
  assert.deepEqual(Object.keys(calls[1].update), ["$setOnInsert"]);
  assert.equal(
    calls[1].update.$setOnInsert.answer,
    calls[0].update.$setOnInsert.answer,
  );
});

test("stores the specified initial crayfish pricing answer", () => {
  assert.equal(
    PRICING_ANSWER,
    [
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
    ].join("\n"),
  );
});

test("seeds the setup FAQ once and keeps it active without replacing edits", async () => {
  const calls = [];
  let inserted = false;
  const model = {
    async updateOne(filter, update, options) {
      calls.push({ filter, update, options });
      if (inserted) return { upsertedCount: 0 };
      inserted = true;
      return { upsertedCount: 1 };
    },
  };

  assert.equal(await seedPondSetupFaq(model), true);
  assert.equal(await seedPondSetupFaq(model), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].filter, {
    $or: [
      { _id: SETUP_FAQ_ID },
      { question: SETUP_QUESTION },
    ],
  });
  assert.deepEqual(calls[0].update, {
    $set: { active: true },
    $setOnInsert: {
      _id: SETUP_FAQ_ID,
      question: SETUP_QUESTION,
      keywords: SETUP_KEYWORDS,
      answer: SETUP_ANSWER,
      link: SETUP_LINK,
      createdAt: calls[0].update.$setOnInsert.createdAt,
      updatedAt: calls[0].update.$setOnInsert.updatedAt,
    },
  });
  assert.equal(
    calls[0].update.$setOnInsert.createdAt,
    calls[0].update.$setOnInsert.updatedAt,
  );
  assert.deepEqual(calls[0].options, {
    upsert: true,
    runValidators: true,
    timestamps: false,
  });
});

test("seeds the contact FAQ once with the official business details", async () => {
  const calls = [];
  let inserted = false;
  const model = {
    async updateOne(filter, update, options) {
      calls.push({ filter, update, options });
      if (inserted) return { upsertedCount: 0 };
      inserted = true;
      return { upsertedCount: 1 };
    },
  };

  assert.equal(await seedContactLocationFaq(model), true);
  assert.equal(await seedContactLocationFaq(model), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].filter, {
    $or: [
      { _id: CONTACT_FAQ_ID },
      { question: CONTACT_QUESTION },
    ],
  });
  assert.deepEqual(calls[0].update, {
    $set: { active: true },
    $setOnInsert: {
      _id: CONTACT_FAQ_ID,
      question: CONTACT_QUESTION,
      keywords: CONTACT_KEYWORDS,
      answer: CONTACT_ANSWER,
      link: null,
      createdAt: calls[0].update.$setOnInsert.createdAt,
      updatedAt: calls[0].update.$setOnInsert.updatedAt,
    },
  });
  assert.equal(
    calls[0].update.$setOnInsert.createdAt,
    calls[0].update.$setOnInsert.updatedAt,
  );
  assert.deepEqual(calls[0].options, {
    upsert: true,
    runValidators: true,
    timestamps: false,
  });
});
