const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { createFaqRouter } = jiti("../server/utils/faq-router.js");
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
  return { app, token, queryCalls };
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
