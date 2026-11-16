const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { createFaqRouter, validateFaqInput } = jiti(
  "../server/utils/faq-router.js",
);
const adminId = "111111111111111111111111";
const faqId = "aaaaaaaaaaaaaaaaaaaaaaaa";

function createFaqApp({ role = "admin", faqRecords = [createFaq()] } = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: adminId,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };
  const queryCalls = [];
  const createCalls = [];
  const faqModel = {
    find(filter) {
      queryCalls.push({ operation: "find", filter });
      return {
        select(fields) {
          assert.match(fields, /question/);
          return {
            sort(order) {
              assert.deepEqual(order, { createdAt: -1, _id: 1 });
              return { lean: async () => faqRecords };
            },
          };
        },
      };
    },
    findById(id) {
      queryCalls.push({ operation: "findById", id });
      return {
        select(fields) {
          assert.match(fields, /answer/);
          return {
            lean: async () =>
              faqRecords.find((faq) => faq._id.toString() === id) ?? null,
          };
        },
      };
    },
    async create(fields) {
      createCalls.push(fields);
      return createFaq(fields);
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.faqModel = faqModel;
    req.authCollections = {
      sessions: { findOne: async () => session },
      users: {
        findOne: async () => ({
          _id: adminId,
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          phoneNumber: "+639171234567",
          role,
          isActive: true,
        }),
      },
    };
    next();
  });
  app.use("/api/admin/faqs", createFaqRouter());
  return { app, token, queryCalls, createCalls };
}

function createFaq(overrides = {}) {
  return {
    _id: faqId,
    question: "How much crayfish?",
    keywords: ["crayfish"],
    answer: "Stored answer.",
    active: true,
    createdBy: adminId,
    updatedBy: adminId,
    ...overrides,
  };
}

test("requires an authenticated administrator", async () => {
  const noSessionApp = express();
  noSessionApp.use("/api/admin/faqs", createFaqRouter());
  await request(noSessionApp)
    .get("/api/admin/faqs")
    .expect(401)
    .expect({ error: "Authentication required." });

  const { app, token } = createFaqApp({ role: "customer" });
  await request(app)
    .get("/api/admin/faqs")
    .set("Cookie", `bossgudo_session=${token}`)
    .expect(403)
    .expect({ error: "Forbidden." });
});

test("lists FAQs for an administrator without caching the response", async () => {
  const { app, token, queryCalls } = createFaqApp();
  const response = await request(app)
    .get("/api/admin/faqs")
    .set("Cookie", `bossgudo_session=${token}`)
    .expect(200);

  assert.deepEqual(response.body, { faqs: [createFaq()] });
  assert.deepEqual(queryCalls, [{ operation: "find", filter: {} }]);
  assert.equal(response.headers["cache-control"], "no-store");
});

test("validates FAQ ids and distinguishes missing records", async () => {
  const { app, token, queryCalls } = createFaqApp({ faqRecords: [] });
  await request(app)
    .get("/api/admin/faqs/not-an-id")
    .set("Cookie", `bossgudo_session=${token}`)
    .expect(400)
    .expect({ error: "Invalid FAQ id." });
  await request(app)
    .get(`/api/admin/faqs/${faqId}`)
    .set("Cookie", `bossgudo_session=${token}`)
    .expect(404)
    .expect({ error: "FAQ not found." });
  assert.deepEqual(queryCalls, [{ operation: "findById", id: faqId }]);
});

test("validates FAQ content and removes duplicate keywords", () => {
  assert.deepEqual(
    validateFaqInput({
      question: "  How much crayfish? ",
      keywords: [" crayfish ", "Crayfish", "juvenile"],
      answer: " Stored answer. ",
    }),
    {
      value: {
        question: "How much crayfish?",
        keywords: ["crayfish", "juvenile"],
        answer: "Stored answer.",
      },
    },
  );
  for (const value of [
    null,
    {},
    { question: "Question", keywords: [], answer: "Answer" },
    {
      question: "Question",
      keywords: ["keyword"],
      answer: "Answer",
      active: "false",
    },
    {
      question: "Question",
      keywords: ["x".repeat(81)],
      answer: "Answer",
    },
  ]) {
    assert.ok(validateFaqInput(value).error);
  }
});

test("creates FAQs with server-controlled audit fields", async () => {
  const { app, token, createCalls } = createFaqApp();
  const response = await request(app)
    .post("/api/admin/faqs")
    .set("Cookie", `bossgudo_session=${token}`)
    .send({
      question: "How much crayfish?",
      keywords: ["crayfish"],
      answer: "Stored answer.",
      createdBy: "222222222222222222222222",
      updatedBy: "333333333333333333333333",
      createdAt: "2000-01-01",
    })
    .expect(201);

  assert.equal(response.body.faq.createdBy, adminId);
  assert.equal(response.body.faq.updatedBy, adminId);
  assert.deepEqual(createCalls, [
    {
      question: "How much crayfish?",
      keywords: ["crayfish"],
      answer: "Stored answer.",
      createdBy: adminId,
      updatedBy: adminId,
    },
  ]);
});

test("rejects invalid FAQ creation without touching the model", async () => {
  const { app, token, createCalls } = createFaqApp();
  await request(app)
    .post("/api/admin/faqs")
    .set("Cookie", `bossgudo_session=${token}`)
    .send({ question: "Question", keywords: [], answer: "Answer" })
    .expect(400);
  assert.deepEqual(createCalls, []);
});
