const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  CUSTOM_POND_PRICING,
  calculateCustomPondCents,
  publicCustomPondPricing,
} = jiti("../server/utils/service-catalog");
const {
  generatePackageCode,
  packageImageUrl,
  packageSnapshot,
  serializeAdminPackage,
  serializePublicPackage,
  validatePackageInput,
} = jiti("../server/utils/service-package");
const { INITIAL_SERVICE_PACKAGES, seedServicePackages } = jiti("../server/utils/service-package-seed");

const decimal = (text) => mongoose.Types.Decimal128.fromString(text);

test("custom pond price is area × layers × rate plus optional filtration", () => {
  assert.equal(calculateCustomPondCents({ layers: 2, width: 2, length: 3, filtration: true }), 690_000);
  assert.equal(calculateCustomPondCents({ layers: 2, width: 2, length: 3, filtration: false }), 540_000);
  assert.equal(calculateCustomPondCents({ layers: 1, width: 1.25, length: 2.5, filtration: false }), 140_625);
  assert.equal(calculateCustomPondCents({ layers: 3, width: 1.33, length: 1.01, filtration: false }), 181_346);
  assert.ok(Object.isFrozen(CUSTOM_POND_PRICING));
});

test("public custom pond pricing is shown in pesos", () => {
  assert.deepEqual(publicCustomPondPricing(), {
    name: "Custom Pond Design",
    ratePerSquareMetrePerLayer: 450,
    filtration: 1500,
    minLayers: 1,
    maxLayers: 3,
    minDimensionMetres: 1,
    maxDimensionMetres: 10,
  });
});

const validBody = {
  name: "  Pond Starter  ",
  description: "A starter pond.",
  layers: "1 layer",
  dimensions: "2 m × 2 m",
  inclusions: ["Free kit", " free KIT ", "", "Feed"],
  price: "6500.50",
};

test("validatePackageInput trims fields, de-duplicates inclusions and defaults status", () => {
  const { value, error } = validatePackageInput(validBody);
  assert.equal(error, undefined);
  assert.equal(value.name, "Pond Starter");
  assert.deepEqual(value.inclusions, ["Free kit", "Feed"]);
  assert.equal(value.price.toString(), "6500.50");
  assert.equal(value.status, "Active");
  assert.equal("featured" in value, false);
  assert.equal(validatePackageInput({ ...validBody, featured: true, status: "Inactive" }).value.status, "Inactive");
});

test("validatePackageInput rejects missing, reserved and malformed fields", () => {
  assert.deepEqual(validatePackageInput(null), { error: "Provide package details." });
  assert.deepEqual(validatePackageInput([]), { error: "Provide package details." });
  assert.deepEqual(validatePackageInput({ ...validBody, name: undefined }), { error: "Package name is required." });
  assert.deepEqual(validatePackageInput({ ...validBody, name: "custom   pond DESIGN" }), { error: "That package name is reserved." });
  assert.deepEqual(validatePackageInput({ ...validBody, name: "x".repeat(71) }), { error: "Package name must be at most 70 characters." });
  assert.deepEqual(validatePackageInput({ ...validBody, price: "0" }), {
    error: "Price must be greater than zero with at most two decimals.",
  });
  assert.deepEqual(validatePackageInput({ ...validBody, inclusions: [" ", ""] }), { error: "Add at least one inclusion." });
  assert.deepEqual(validatePackageInput({ ...validBody, inclusions: [5] }), { error: "Each inclusion must be text." });
  assert.deepEqual(validatePackageInput({ ...validBody, inclusions: Array.from({ length: 11 }, (_, n) => `Item ${n}`) }), {
    error: "Add at most 10 inclusions.",
  });
  assert.deepEqual(validatePackageInput({ ...validBody, featured: "yes" }), { error: "Featured must be true or false." });
  assert.deepEqual(validatePackageInput({ ...validBody, status: "Archived" }), { error: "Status must be Active or Inactive." });
});

test("validatePackageInput in partial mode reads only the given fields", () => {
  assert.deepEqual(validatePackageInput({ featured: false }, { partial: true }), { value: { featured: false } });
  assert.deepEqual(validatePackageInput({ status: "Inactive", code: "x" }, { partial: true }), {
    error: "Provide at least one package field to update.",
  });
  const { value } = validatePackageInput({ price: 99 }, { partial: true });
  assert.equal(value.price.toString(), "99.00");
  assert.deepEqual(Object.keys(value), ["price"]);
});

test("generatePackageCode slugifies the name and skips taken or reserved codes", async () => {
  const taken = new Set(["pond-starter", "pond-starter-2"]);
  const ServicePackage = { exists: async ({ code }) => taken.has(code) };
  assert.equal(await generatePackageCode(ServicePackage, "Pond Starter!"), "pond-starter-3");
  assert.equal(await generatePackageCode(ServicePackage, "Custom"), "custom-2");
  assert.equal(await generatePackageCode(ServicePackage, "★"), "package");
  // Existing behaviour: NFKD splits "ñ" into "n" + a combining mark, which
  // becomes a hyphen. Recorded as-is; changing it is a separate decision.
  assert.equal(await generatePackageCode(ServicePackage, "Ñandú Pond"), "n-andu-pond");
});

const storedPackage = {
  _id: new mongoose.Types.ObjectId(),
  code: "pk1",
  name: "Pond Starter Package",
  description: "Starter",
  category: "Pond Package",
  price: decimal("6500.00"),
  layers: "1 layer",
  dimensions: "2 m × 2 m",
  inclusions: ["Free kit"],
  featured: true,
  sortOrder: 2,
  status: "Active",
  image: { fileId: new mongoose.Types.ObjectId(), contentType: "image/png", size: 10, uploadedAt: new Date(1_700_000_000_000) },
  createdBy: { firstName: "Ana", lastName: "Reyes", email: "hidden@example.com" },
  updatedBy: new mongoose.Types.ObjectId(),
  createdAt: new Date(1),
  updatedAt: new Date(2),
};

test("package image URLs are versioned and scoped to public or admin routes", () => {
  assert.equal(packageImageUrl(storedPackage), "/api/service-packages/pk1/image?v=1700000000000");
  assert.equal(packageImageUrl(storedPackage, { admin: true }), "/api/admin/service-packages/pk1/image?v=1700000000000");
  assert.equal(packageImageUrl({ ...storedPackage, image: null }), null);
});

test("public serialization exposes catalog fields only", () => {
  assert.deepEqual(serializePublicPackage({ toObject: () => storedPackage }), {
    code: "pk1",
    name: "Pond Starter Package",
    description: "Starter",
    category: "Pond Package",
    price: 6500,
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    inclusions: ["Free kit"],
    featured: true,
    imageUrl: "/api/service-packages/pk1/image?v=1700000000000",
  });
});

test("admin serialization adds status, order, photo and staff names only", () => {
  const admin = serializeAdminPackage(storedPackage);
  assert.equal(admin.imageUrl, "/api/admin/service-packages/pk1/image?v=1700000000000");
  assert.deepEqual(admin.image, { contentType: "image/png", size: 10, uploadedAt: storedPackage.image.uploadedAt });
  assert.equal(admin.sortOrder, 2);
  assert.equal(admin.status, "Active");
  assert.deepEqual(admin.createdBy, { firstName: "Ana", lastName: "Reyes" });
  assert.equal(admin.updatedBy, null);
  assert.equal(admin._id, undefined);
});

test("packageSnapshot copies the booking-time package details", () => {
  const snapshot = packageSnapshot(storedPackage);
  assert.deepEqual(Object.keys(snapshot), ["code", "name", "description", "category", "layers", "dimensions", "inclusions", "price"]);
  assert.equal(snapshot.price, storedPackage.price);
  assert.notEqual(snapshot.inclusions, storedPackage.inclusions);
  assert.deepEqual(packageSnapshot({ ...storedPackage, inclusions: undefined }).inclusions, []);
});

test("seedServicePackages inserts only missing packages and tolerates races", async () => {
  assert.deepEqual(INITIAL_SERVICE_PACKAGES.map((item) => [item.code, item.priceCents]), [
    ["pk1", 650_000],
    ["pk2", 950_000],
    ["pk3", 1_450_000],
  ]);
  const saved = [];
  class FakePackage {
    static async exists({ code }) {
      return code === "pk1";
    }
    constructor(fields) {
      Object.assign(this, fields);
    }
    async save() {
      if (this.code === "pk3") throw Object.assign(new Error("duplicate"), { code: 11000 });
      saved.push(this);
    }
  }
  assert.deepEqual(await seedServicePackages(FakePackage), { inserted: 1, total: 3 });
  assert.equal(saved[0].code, "pk2");
  assert.equal(saved[0].price.toString(), "9500.00");
  assert.equal(saved[0].status, "Active");
  assert.equal(saved[0].image, null);

  class BrokenPackage extends FakePackage {
    static async exists() {
      return false;
    }
    async save() {
      throw new Error("connection lost");
    }
  }
  await assert.rejects(seedServicePackages(BrokenPackage), /connection lost/);
});
