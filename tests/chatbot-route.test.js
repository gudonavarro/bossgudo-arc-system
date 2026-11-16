const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  createChatbotMessageHandler,
  validateChatbotMessage,
} = jiti("../server/api/chatbot/message.post.js");

const pricingFaq = {
  _id: "faq-pricing",
  question: "How much crayfish?",
  keywords: ["crayfish", "craylings", "juvenile"],
  answer: "Crayfish prices are stored in this FAQ.",
  active: true,
};

function createHandler(faqs, overrides = {}) {
  const queryCalls = [];
  const handler = createChatbotMessageHandler({
    readRequestBody: async (event) => event.body,
    connect: async () => "connection",
    getRuntimeConfig: () => ({}),
    getModel: () => ({
      find(filter) {
        queryCalls.push(filter);
        return {
          select(fields) {
            assert.equal(fields, "question keywords answer");
            return { lean: async () => faqs };
          },
        };
      },
    }),
    ...overrides,
  });
  return { handler, queryCalls };
}

test("validates the request body and enforces the message length limit", () => {
  assert.equal(validateChatbotMessage({ message: "  How much?  " }), "How much?");
  for (const body of [null, [], {}, { message: "  " }, { message: 42 }]) {
    assert.throws(
      () => validateChatbotMessage(body),
      (error) => error.statusCode === 400,
    );
  }
  assert.throws(
    () => validateChatbotMessage({ message: "x".repeat(1001) }),
    (error) => error.statusCode === 400,
  );
});

test("loads only active FAQs and returns the stored answer and id", async () => {
  const { handler, queryCalls } = createHandler([pricingFaq]);
  const response = await handler({ body: { message: "How much crayfish?" } });

  assert.deepEqual(queryCalls, [{ active: true }]);
  assert.deepEqual(response, {
    success: true,
    matched: true,
    answer: pricingFaq.answer,
    faqId: pricingFaq._id,
  });
});

test("returns the prescribed fallback without exposing FAQ data", async () => {
  const { handler } = createHandler([]);
  const response = await handler({ body: { message: "How much?" } });

  assert.deepEqual(response, {
    success: true,
    matched: false,
    answer:
      "Sorry, I couldn't find an exact answer to your question. You may try rephrasing your inquiry or contact Boss Gudo A.R.C. Aqua Farm directly for further assistance.",
  });
});

test("uses updated active FAQ data on each request", async () => {
  const faq = { ...pricingFaq, answer: "Original answer." };
  const { handler, queryCalls } = createHandler([faq]);

  const original = await handler({
    body: { message: "How much crayfish?" },
  });
  faq.answer = "Updated administrator answer.";
  const updated = await handler({
    body: { message: "How much crayfish?" },
  });
  faq.active = false;
  const inactive = await handler({
    body: { message: "How much crayfish?" },
  });

  assert.equal(original.answer, "Original answer.");
  assert.equal(updated.answer, "Updated administrator answer.");
  assert.equal(inactive.matched, false);
  assert.equal(queryCalls.length, 3);
});

test("reports FAQ database failures as temporary unavailability", async () => {
  const { handler } = createHandler([], {
    connect: async () => {
      throw new Error("database details must not be exposed");
    },
  });
  const originalError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  try {
    await assert.rejects(
      handler({ body: { message: "How much crayfish?" } }),
      (error) => error.statusCode === 503,
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(loggedErrors, [["Chatbot FAQ lookup failed:", "Error"]]);
});
