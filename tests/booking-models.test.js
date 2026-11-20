const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const { getAvailableDateModel, AVAILABLE_DATE_STATUSES, BOOKING_KINDS } = jiti("../server/models/available-date");
const { getPaymentModel, PAYMENT_TARGETS, PAYMENT_RECORD_STATUSES } = jiti("../server/models/payment");
const {
  getServiceBookingModel,
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
} = jiti("../server/models/service-booking");
const { getVisitationBookingModel, VISIT_TYPES, VISITATION_STATUSES } = jiti("../server/models/visitation-booking");
const {
  getServicePackageModel,
  normalizePackageName,
  PACKAGE_CODE_PATTERN,
  PACKAGE_LIMITS,
  RESERVED_PACKAGE_NAMES,
} = jiti("../server/models/service-package");

const connection = mongoose.createConnection();
const AvailableDate = getAvailableDateModel(connection);
const Payment = getPaymentModel(connection);
const ServiceBooking = getServiceBookingModel(connection);
const VisitationBooking = getVisitationBookingModel(connection);
const ServicePackage = getServicePackageModel(connection);

const decimal = (text) => mongoose.Types.Decimal128.fromString(text);
const id = () => new mongoose.Types.ObjectId();

/** Runs full validation (including pre-validate hooks); returns the error paths. */
async function invalidPaths(document) {
  try {
    await document.validate();
    return [];
  } catch (error) {
    return Object.keys(error.errors ?? {}).sort();
  }
}

function indexFor(model, keys) {
  return model.schema.indexes().find(([fields]) => JSON.stringify(fields) === JSON.stringify(keys));
}

test("model getters reuse the compiled model and target the expected collections", () => {
  assert.equal(getAvailableDateModel(connection), AvailableDate);
  assert.equal(getPaymentModel(connection), Payment);
  assert.equal(getServiceBookingModel(connection), ServiceBooking);
  assert.equal(getVisitationBookingModel(connection), VisitationBooking);
  assert.equal(getServicePackageModel(connection), ServicePackage);
  assert.equal(AvailableDate.collection.collectionName, "available_dates");
  assert.equal(Payment.collection.collectionName, "payments");
  assert.equal(ServiceBooking.collection.collectionName, "service_bookings");
  assert.equal(VisitationBooking.collection.collectionName, "visitation_bookings");
  assert.equal(ServicePackage.collection.collectionName, "service_packages");
});

test("exported status and type lists are unchanged and frozen", () => {
  assert.deepEqual([...BOOKING_KINDS], ["service", "visit"]);
  assert.deepEqual([...AVAILABLE_DATE_STATUSES], ["Open", "Closed"]);
  assert.deepEqual([...PAYMENT_TARGETS], ["deposit", "balance"]);
  assert.deepEqual([...PAYMENT_RECORD_STATUSES], ["Pending", "Verified", "Rejected"]);
  assert.deepEqual([...SERVICE_TYPES], ["Pond Package", "Custom Pond Design"]);
  assert.deepEqual([...BOOKING_STATUSES], ["Pending", "Approved", "Rejected", "Confirmed", "Ongoing", "Completed", "Cancelled"]);
  assert.deepEqual([...PAYMENT_STATUSES], ["Unpaid", "Verification Pending", "Partially Paid", "Paid", "Rejected"]);
  assert.deepEqual([...VISIT_TYPES], ["Regular", "Special"]);
  assert.deepEqual([...VISITATION_STATUSES], ["Booked", "Pending Review", "Approved", "Declined", "Completed", "Cancelled"]);
  assert.deepEqual([...RESERVED_PACKAGE_NAMES], ["custom pond design"]);
  for (const list of [BOOKING_KINDS, PAYMENT_TARGETS, BOOKING_STATUSES, VISITATION_STATUSES, PACKAGE_LIMITS]) {
    assert.ok(Object.isFrozen(list));
  }
});

test("available dates validate kind, status and reason length", async () => {
  const valid = new AvailableDate({ date: new Date("2027-01-02"), bookingKind: "service", status: "Closed" });
  assert.deepEqual(await invalidPaths(valid), []);
  assert.equal(valid.reason, "");
  const invalid = new AvailableDate({ date: new Date(), bookingKind: "party", status: "Maybe", reason: "x".repeat(301) });
  assert.deepEqual(await invalidPaths(invalid), ["bookingKind", "reason", "status"]);
  assert.deepEqual(indexFor(AvailableDate, { date: 1, bookingKind: 1 })[1], { unique: true });
});

test("payments require positive amounts and allow one pending payment per booking", async () => {
  const base = {
    service_booking_id: id(),
    paymentTarget: "deposit",
    amount: decimal("500.00"),
    expectedAmount: decimal("500.00"),
    gcashReference: " 1234567890 ",
    receiptFileName: "receipt.jpg",
    receiptStorageKey: "receipts/abc",
  };
  const valid = new Payment(base);
  assert.deepEqual(await invalidPaths(valid), []);
  assert.equal(valid.status, "Pending");
  assert.equal(valid.gcashReference, "1234567890");
  assert.ok(valid.submittedAt instanceof Date);

  const zero = new Payment({ ...base, amount: decimal("0.00"), expectedAmount: decimal("-1.00"), paymentTarget: "tip" });
  assert.deepEqual(await invalidPaths(zero), ["amount", "expectedAmount", "paymentTarget"]);
  try {
    await zero.validate();
  } catch (error) {
    assert.equal(error.errors.amount.message, "Payment amounts must be greater than zero.");
  }

  const pending = Payment.schema.indexes().find(([, options]) => options.name === "one_pending_payment_per_booking");
  assert.deepEqual(pending[0], { service_booking_id: 1 });
  assert.equal(pending[1].unique, true);
  assert.deepEqual(pending[1].partialFilterExpression, { status: "Pending" });
});

function serviceBooking(overrides = {}) {
  return new ServiceBooking({
    customer_id: id(),
    reference: "SB-20270102-ABCDEF",
    serviceType: "Pond Package",
    packageSnapshot: {
      code: "pk1",
      name: "Pond Starter Package",
      inclusions: ["Free kit"],
      price: decimal("6500.00"),
    },
    serviceDate: new Date("2027-01-02"),
    serviceLocation: "General Trias, Cavite",
    customerName: "Juan Dela Cruz",
    customerEmail: "JUAN@Example.com",
    customerPhone: "09171234567",
    totalAmount: decimal("6500.00"),
    depositAmount: decimal("3250.00"),
    ...overrides,
  });
}

test("service bookings default fees and statuses and lowercase the email", async () => {
  const booking = serviceBooking();
  assert.deepEqual(await invalidPaths(booking), []);
  assert.equal(booking.customizationFee.toString(), "0.00");
  assert.equal(booking.deliveryFee.toString(), "0.00");
  assert.equal(booking.paidAmount.toString(), "0.00");
  assert.equal(booking.bookingStatus, "Pending");
  assert.equal(booking.paymentStatus, "Unpaid");
  assert.equal(booking.customerEmail, "juan@example.com");
  assert.equal(booking.packageSnapshot.category, "Pond Package");
  assert.ok(ServiceBooking.schema.options.optimisticConcurrency);
});

test("service bookings keep stored amounts consistent", async () => {
  assert.deepEqual(await invalidPaths(serviceBooking({ totalAmount: decimal("7000.00") })), ["totalAmount"]);
  assert.deepEqual(
    await invalidPaths(serviceBooking({ depositAmount: decimal("7000.00"), paidAmount: decimal("7000.00") })),
    ["depositAmount", "paidAmount"],
  );
  assert.deepEqual(await invalidPaths(serviceBooking({ deliveryFee: decimal("-5.00") })), ["deliveryFee", "totalAmount"]);
  assert.deepEqual(
    await invalidPaths(serviceBooking({ deliveryFee: decimal("250.00"), totalAmount: decimal("6750.00") })),
    [],
  );
});

test("service bookings match the package snapshot to the service type", async () => {
  assert.deepEqual(await invalidPaths(serviceBooking({ packageSnapshot: null })), ["packageSnapshot", "totalAmount"]);
  assert.deepEqual(await invalidPaths(serviceBooking({ serviceType: "Custom Pond Design" })), ["packageSnapshot"]);
  const custom = serviceBooking({
    serviceType: "Custom Pond Design",
    packageSnapshot: null,
    customConfiguration: { layers: 2, width: 2, length: 3, filtration: true },
    customizationFee: decimal("6900.00"),
    totalAmount: decimal("6900.00"),
    depositAmount: decimal("3450.00"),
  });
  assert.deepEqual(await invalidPaths(custom), []);
  assert.equal(custom.packageSnapshot, null);
});

function visit(overrides = {}) {
  return new VisitationBooking({
    customer_id: id(),
    reference: "VS-20270102-ABCDEF",
    visitDate: new Date("2027-01-02"),
    visitType: "Regular",
    visitorCount: 3,
    customerName: "Juan Dela Cruz",
    customerEmail: "juan@example.com",
    customerPhone: "09171234567",
    status: "Booked",
    ...overrides,
  });
}

test("visitation bookings validate visitor count and special-date reasons", async () => {
  const valid = visit();
  assert.deepEqual(await invalidPaths(valid), []);
  assert.equal(valid.farmName, "");
  assert.deepEqual(await invalidPaths(visit({ visitType: "Special" })), ["specialRequestReason"]);
  assert.deepEqual(await invalidPaths(visit({ visitType: "Special", specialRequestReason: "Group tour" })), []);
  for (const visitorCount of [0, 6, 1.5]) {
    assert.deepEqual(await invalidPaths(visit({ visitorCount })), ["visitorCount"], `count ${visitorCount}`);
  }
  assert.deepEqual(await invalidPaths(visit({ status: "Lost", visitType: "VIP" })), ["status", "visitType"]);
});

function servicePackage(overrides = {}) {
  return new ServicePackage({
    code: "pk-test",
    name: "  Pond   Starter  ",
    description: "A starter pond.",
    price: decimal("6500.00"),
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    inclusions: ["Free kit"],
    sortOrder: 0,
    ...overrides,
  });
}

test("service packages derive a normalized name key and apply defaults", async () => {
  const pkg = servicePackage();
  assert.deepEqual(await invalidPaths(pkg), []);
  assert.equal(pkg.nameKey, "pond starter");
  assert.equal(pkg.status, "Active");
  assert.equal(pkg.category, "Pond Package");
  assert.equal(pkg.featured, false);
  assert.equal(pkg.image, null);
  assert.equal(normalizePackageName("  Custom   POND design "), "custom pond design");
  assert.equal(normalizePackageName(undefined), "");
  assert.ok(PACKAGE_CODE_PATTERN.test("pk1"));
  assert.ok(!PACKAGE_CODE_PATTERN.test("-pk"));
});

test("service packages reject reserved names, bad prices, codes and inclusions", async () => {
  assert.deepEqual(await invalidPaths(servicePackage({ name: "Custom Pond Design" })), ["name"]);
  assert.deepEqual(await invalidPaths(servicePackage({ price: decimal("0.00") })), ["price"]);
  assert.deepEqual(await invalidPaths(servicePackage({ code: "Bad Code!" })), ["code"]);
  assert.deepEqual(await invalidPaths(servicePackage({ inclusions: [] })), ["inclusions"]);
  assert.deepEqual(
    await invalidPaths(servicePackage({ inclusions: Array.from({ length: 11 }, (_, n) => `Item ${n}`) })),
    ["inclusions"],
  );
  assert.deepEqual(await invalidPaths(servicePackage({ sortOrder: 1.5 })), ["sortOrder"]);
  assert.deepEqual(await invalidPaths(servicePackage({ status: "Archived" })), ["status"]);
});
