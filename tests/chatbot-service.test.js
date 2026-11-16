const assert = require("node:assert/strict");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  FALLBACK_ANSWER,
  findBestFaqMatch,
  getChatbotResponse,
  normalizeChatMessage,
} = jiti("../server/utils/chatbot.service.js");
const {
  CONTACT_ANSWER,
  CONTACT_KEYWORDS,
  CONTACT_QUESTION,
} = jiti("../server/utils/faq-seed.js");

const pricingFaq = {
  _id: "faq-pricing",
  question: "How much crayfish?",
  keywords: [
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
  ],
  answer: "Stored crayfish price list.",
  active: true,
};

const setupFaq = {
  _id: "faq-setup",
  question: "How much setup?",
  keywords: [
    "setup",
    "pond setup",
    "setup price",
    "setup cost",
    "how much setup",
    "PVC setup",
    "slotted angle bar setup",
    "pond package",
  ],
  answer: "You can view our available pond setups in our Shop.",
  link: { label: "View Setups", href: "/shop" },
  active: true,
};

const contactFaq = {
  _id: "faq-contact",
  question: CONTACT_QUESTION,
  keywords: CONTACT_KEYWORDS,
  answer: CONTACT_ANSWER,
  active: true,
};

test("normalizes case, punctuation, and repeated whitespace", () => {
  assert.equal(
    normalizeChatMessage("  HOW much... crayfish?!  "),
    "how much crayfish",
  );
});

test("matches the exact question, meaningful phrases, and configured keywords", () => {
  for (const message of [
    "How much crayfish?",
    "Could you tell me: how much crayfish, please?",
    "What is the price of craylings?",
    "How much are the juveniles?",
    "How much is the breeder trio?",
    "Do you sell breeder quadro?",
    "What is your kilo order price?",
    "Magkano ang crayfish?",
  ]) {
    assert.equal(
      findBestFaqMatch(message, [pricingFaq]),
      pricingFaq,
      `expected pricing FAQ to match: ${message}`,
    );
  }
});

test("does not match generic-only or unrelated messages", () => {
  for (const message of [
    "How much?",
    "What is the price?",
    "Hello.",
    "How do I book?",
  ]) {
    assert.equal(findBestFaqMatch(message, [pricingFaq]), null, message);
  }

  const genericQuestionFaq = {
    question: "How much?",
    keywords: ["price"],
    answer: "A generic answer.",
  };
  assert.equal(findBestFaqMatch("How much?", [genericQuestionFaq]), null);
});

test("uses partial meaningful words only alongside enough matching evidence", () => {
  const faq = {
    _id: "faq-partial",
    question: "Crayfish pricing",
    keywords: ["crayfish", "juvenile", "craylings"],
    answer: "Stored answer.",
  };
  assert.equal(findBestFaqMatch("crayfi juveniles craylin", [faq]), faq);
  assert.equal(findBestFaqMatch("crayfi", [faq]), null);
});

test("ranks multiple matching keywords above a single keyword", () => {
  const singleKeywordFaq = {
    _id: "faq-single",
    question: "Crayfish orders",
    keywords: ["crayfish"],
    answer: "Single-keyword answer.",
  };
  const multipleKeywordFaq = {
    _id: "faq-multiple",
    question: "Crayfish and craylings",
    keywords: ["crayfish", "craylings"],
    answer: "Multiple-keyword answer.",
  };

  assert.equal(
    findBestFaqMatch("crayfish craylings", [
      singleKeywordFaq,
      multipleKeywordFaq,
    ]),
    multipleKeywordFaq,
  );
});

test("returns only the stored answer and FAQ id, or the specified fallback", () => {
  assert.deepEqual(getChatbotResponse("How much crayfish?", [pricingFaq]), {
    matched: true,
    answer: pricingFaq.answer,
    faqId: pricingFaq._id,
  });
  assert.deepEqual(getChatbotResponse("How much?", [pricingFaq]), {
    matched: false,
    answer: FALLBACK_ANSWER,
  });
});

test("returns stored setup links for the supported setup-price questions", () => {
  for (const message of [
    "How much setup?",
    "How much is the pond setup?",
    "What are your setup prices?",
    "How much does setup cost?",
  ]) {
    assert.deepEqual(getChatbotResponse(message, [setupFaq]), {
      matched: true,
      answer: setupFaq.answer,
      faqId: setupFaq._id,
      link: setupFaq.link,
    });
  }
});

test("matches the stored contact FAQ for location and contact questions", () => {
  for (const message of [
    "Where is your farm?",
    "What is your address?",
    "Where are you located?",
    "How can I contact you?",
    "What is your contact number?",
    "Where can I find you?",
    "Are you near EPZA?",
  ]) {
    assert.deepEqual(getChatbotResponse(message, [contactFaq]), {
      matched: true,
      answer: CONTACT_ANSWER,
      faqId: contactFaq._id,
    }, message);
  }
});

test("excludes inactive FAQs and applies stable score tie-breaking", () => {
  const inactive = { ...pricingFaq, active: false };
  assert.equal(findBestFaqMatch("crayfish", [inactive]), null);

  const first = {
    _id: "faq-b",
    question: "How much are craylings?",
    keywords: ["crayfish"],
    answer: "B",
  };
  const second = {
    _id: "faq-a",
    question: "How much are craylings?",
    keywords: ["crayfish"],
    answer: "A",
  };
  assert.equal(findBestFaqMatch("crayfish", [first, second]), second);
  assert.equal(findBestFaqMatch("crayfish", [second, first]), second);
});
