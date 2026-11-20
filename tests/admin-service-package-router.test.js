const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const test = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { getServicePackageModel } = jiti("../server/models/service-package");
const { createAdminServicePackageRouter, handlePackageError } = jiti(
  "../server/utils/admin-service-package-router.js",
);

const adminId = "111111111111111111111111";

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => doc.get(key) === value);
}

/**
 * The real ServicePackage model (so schema validation and hooks run) backed
 * by an in-memory list instead of MongoDB. Only the queries the admin
 * package router uses are supported.
 */
function createInMemoryPackageModel() {
  const ServicePackage = getServicePackageModel(mongoose.createConnection());
  const store = [];

  const query = (resolve) => {
    const chain = {
      sort: () => chain,
      select: () => chain,
      session: () => chain,
      populate: () => chain,
      lean: async () => {
        const result = resolve();
        if (Array.isArray(result)) return result.map((doc) => doc.toObject());
        return result ? result.toObject() : null;
      },
      then: (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return chain;
  };

  ServicePackage.exists = async (filter) => {
    const found = store.find((doc) => matches(doc, filter));
    return found ? { _id: found._id } : null;
  };
  ServicePackage.find = (filter = {}) => query(() => store.filter((doc) => matches(doc, filter)));
  ServicePackage.findOne = (filter = {}) =>
    query(() => {
      const found = store.filter((doc) => matches(doc, filter));
      // Only nextSortOrder queries with an empty filter, sorted by sortOrder desc.
      return found.sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? null;
    });
  ServicePackage.prototype.save = async function save() {
    await this.validate();
    if (store.some((doc) => doc !== this && doc.code === this.code)) {
      throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { code: 1 } });
    }
    if (!store.includes(this)) store.push(this);
    return this;
  };
  ServicePackage.prototype.populate = async function populate() {
    return this;
  };

  return { ServicePackage, store };
}

function createApp() {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    _id: "session-1",
    userId: adminId,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };
  const { ServicePackage, store } = createInMemoryPackageModel();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.packageModels = { ServicePackage };
    req.authCollections = {
      sessions: { findOne: async () => session },
      users: {
        findOne: async () => ({
          _id: adminId,
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          isActive: true,
        }),
      },
    };
    next();
  });
  app.use("/api/admin/service-packages", createAdminServicePackageRouter());
  const agent = (method, path) =>
    request(app)[method](`/api/admin/service-packages${path}`).set("Cookie", `bossgudo_session=${token}`);
  return { agent, store };
}

const pondStarter = (overrides = {}) => ({
  name: "Pond Starter",
  description: "A starter pond.",
  layers: "1 layer",
  dimensions: "2 m × 2 m",
  inclusions: ["Free kit"],
  price: "6500.00",
  ...overrides,
});

test("packages with the same name but different size and price are saved separately", async () => {
  const { agent, store } = createApp();

  const small = await agent("post", "/").send(pondStarter()).expect(201);
  const large = await agent("post", "/")
    .send(pondStarter({ dimensions: "3 m × 3 m", price: "9500.00" }))
    .expect(201);
  // Same name with different spacing and case is also allowed.
  const variant = await agent("post", "/")
    .send(pondStarter({ name: "  pond   STARTER ", dimensions: "4 m × 4 m", price: "12000.00" }))
    .expect(201);

  assert.equal(small.body.package.code, "pond-starter");
  assert.equal(large.body.package.code, "pond-starter-2");
  assert.equal(variant.body.package.code, "pond-starter-3");
  assert.equal(large.body.package.name, "Pond Starter");
  assert.equal(large.body.package.price, 9500);
  assert.equal(store.length, 3);

  const list = await agent("get", "/").expect(200);
  assert.deepEqual(
    list.body.packages.map((pkg) => [pkg.code, pkg.name, pkg.dimensions, pkg.price]),
    [
      ["pond-starter", "Pond Starter", "2 m × 2 m", 6500],
      ["pond-starter-2", "Pond Starter", "3 m × 3 m", 9500],
      ["pond-starter-3", "pond   STARTER", "4 m × 4 m", 12000],
    ],
  );
});

test("same-name packages are edited and managed independently by code", async () => {
  const { agent, store } = createApp();
  await agent("post", "/").send(pondStarter()).expect(201);
  await agent("post", "/").send(pondStarter({ dimensions: "3 m × 3 m", price: "9500.00" })).expect(201);
  await agent("post", "/").send(pondStarter({ name: "Pond Deluxe", price: "15000.00" })).expect(201);

  // Editing one package only changes that package.
  const edited = await agent("patch", "/pond-starter-2").send({ price: "9800.00" }).expect(200);
  assert.equal(edited.body.package.price, 9800);
  assert.equal(store.find((doc) => doc.code === "pond-starter").price.toString(), "6500.00");

  // Renaming a package to a name another package already uses is allowed.
  const renamed = await agent("patch", "/pond-deluxe").send({ name: "Pond Starter" }).expect(200);
  assert.equal(renamed.body.package.name, "Pond Starter");
  assert.equal(renamed.body.package.code, "pond-deluxe");

  await agent("patch", "/pond-starter/status").send({ status: "Inactive" }).expect(200);
  assert.deepEqual(
    store.map((doc) => [doc.code, doc.status]),
    [
      ["pond-starter", "Inactive"],
      ["pond-starter-2", "Active"],
      ["pond-deluxe", "Active"],
    ],
  );

  const copy = await agent("post", "/pond-starter-2/duplicate").expect(201);
  assert.equal(copy.body.package.name, "Pond Starter (Copy)");
  assert.equal(copy.body.package.price, 9800);
  const secondCopy = await agent("post", "/pond-starter/duplicate").expect(201);
  assert.equal(secondCopy.body.package.name, "Pond Starter (Copy 2)");
  assert.notEqual(secondCopy.body.package.code, copy.body.package.code);
});

test("other package rules are still enforced", async () => {
  const { agent } = createApp();
  await agent("post", "/")
    .send(pondStarter({ name: "Custom Pond Design" }))
    .expect(400, { error: "That package name is reserved." });
  await agent("post", "/")
    .send(pondStarter({ name: " " }))
    .expect(400, { error: "Package name is required." });
  await agent("post", "/")
    .send(pondStarter({ price: "0" }))
    .expect(400, { error: "Price must be greater than zero with at most two decimals." });
  await agent("post", "/").send(pondStarter()).expect(201);
  await agent("patch", "/pond-starter")
    .send({ name: "custom   POND design" })
    .expect(400, { error: "That package name is reserved." });
});

test("a code collision from a simultaneous save is reported as a retryable conflict", () => {
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const error = Object.assign(new Error("E11000"), { code: 11000, keyPattern: { code: 1 } });
  handlePackageError(response, error, "Package creation");
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: "Another package was saved at the same time. Please try again.",
  });
});
