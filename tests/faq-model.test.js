const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { getFaqModel } = jiti("../server/models/faq.js");
const connection = mongoose.createConnection();
const FAQModel = getFaqModel(connection);

test("defines FAQ fields, defaults, references, and timestamps", async () => {
  const createdBy = new mongoose.Types.ObjectId();
  const faq = new FAQModel({
    question: " How much crayfish? ",
    keywords: [" crayfish ", "craylings"],
    answer: " Crayfish prices are available here. ",
    createdBy,
    updatedBy: createdBy,
  });

  await faq.validate();
  await FAQModel.schema.s.hooks.execPre("save", faq, []);

  assert.equal(FAQModel.collection.collectionName, "faqs");
  assert.equal(faq.question, "How much crayfish?");
  assert.deepEqual(faq.keywords, ["crayfish", "craylings"]);
  assert.equal(faq.answer, "Crayfish prices are available here.");
  assert.equal(faq.active, true);
  assert.equal(faq.createdBy.toString(), createdBy.toString());
  assert.equal(faq.updatedBy.toString(), createdBy.toString());
  assert.equal(FAQModel.schema.path("createdBy").options.ref, "User");
  assert.equal(FAQModel.schema.path("updatedBy").options.ref, "User");
  assert.equal(FAQModel.schema.options.timestamps, true);
  assert.ok(faq.createdAt instanceof Date);
  assert.ok(faq.updatedAt instanceof Date);
});

test("requires a question, non-empty keywords, and an answer", async () => {
  await assert.rejects(new FAQModel().validate(), mongoose.Error.ValidationError);
  await assert.rejects(
    new FAQModel({
      question: "Question",
      keywords: [],
      answer: "Answer",
    }).validate(),
    mongoose.Error.ValidationError,
  );
  await assert.rejects(
    new FAQModel({
      question: "Question",
      keywords: ["   "],
      answer: "Answer",
    }).validate(),
    mongoose.Error.ValidationError,
  );
});

test("validates audit fields as User ObjectIds", async () => {
  const faq = new FAQModel({
    question: "Question",
    keywords: ["keyword"],
    answer: "Answer",
    createdBy: "not-an-object-id",
  });

  await assert.rejects(faq.validate(), mongoose.Error.ValidationError);
});

test("returns the existing model rather than recompiling it", () => {
  assert.equal(getFaqModel(connection), FAQModel);
});
