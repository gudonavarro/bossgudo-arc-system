const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const test = require("node:test");
const { createJiti } = require("jiti");
const { createSession, SESSION_DURATION_MS } = require("../server/utils/session");

const jiti = createJiti(__filename);
const { getSessionModel } = jiti("../server/models/session.ts");
const connection = mongoose.createConnection();
const SessionModel = getSessionModel(connection);

test("defines the Session fields, timestamps, and indexes", () => {
  assert.equal(SessionModel.collection.collectionName, "sessions");
  assert.equal(SessionModel.schema.path("_id").instance, "ObjectId");
  assert.equal(SessionModel.schema.path("userId").instance, "ObjectId");
  assert.equal(SessionModel.schema.path("tokenHash").instance, "String");
  assert.equal(SessionModel.schema.path("expiresAt").instance, "Date");
  assert.equal(SessionModel.schema.options.timestamps, true);

  const indexes = SessionModel.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1));
  assert.ok(
    indexes.some(
      ([keys, options]) =>
        keys.expiresAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
  assert.equal(getSessionModel(connection), SessionModel);
});

test("creates a random cookie token while persisting only its hash", async () => {
  const documents = [];
  const sessionRepository = {
    async insertOne(document) {
      documents.push(document);
    },
  };
  const userId = new mongoose.Types.ObjectId();
  const now = new Date("2026-01-01T00:00:00.000Z");
  const { token, expiresAt } = await createSession(
    sessionRepository,
    userId,
    now,
  );

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].userId, userId);
  assert.equal(
    documents[0].tokenHash,
    crypto.createHash("sha256").update(token).digest("hex"),
  );
  assert.notEqual(documents[0].tokenHash, token);
  assert.equal(documents[0].expiresAt.getTime(), now.getTime() + SESSION_DURATION_MS);
  assert.equal(documents[0].createdAt, now);
});
