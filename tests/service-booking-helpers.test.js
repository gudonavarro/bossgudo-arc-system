const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  HttpError,
  OBJECT_ID_PATTERN,
  bookingCents,
  bookingIdentifierFilter,
  derivePaymentStatus,
  escapeRegExp,
  getErrorName,
  handleRouteError,
  isDateClosed,
  isDuplicateKeyError,
  isWeekendDate,
  paginationMeta,
  parseCalendarDate,
  parseFutureServiceDate,
  parsePagination,
  saveWithUniqueReference,
  serializeBooking,
  serializePayment,
  validateCustomerContact,
  withTransaction,
} = jiti("../server/utils/service-booking");

const decimal = (text) => mongoose.Types.Decimal128.fromString(text);

function fakeResponse() {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

test("HttpError carries a status and getErrorName reads error names safely", () => {
  const error = new HttpError(404, "Booking not found.");
  assert.ok(error instanceof Error);
  assert.equal(error.name, "HttpError");
  assert.equal(error.status, 404);
  assert.equal(error.message, "Booking not found.");
  assert.equal(getErrorName(new TypeError("x")), "TypeError");
  assert.equal(getErrorName("boom"), "UnknownError");
  assert.equal(getErrorName(null), "UnknownError");
});

test("isDuplicateKeyError matches code 11000, optionally on a given field", () => {
  const duplicate = { code: 11000, keyPattern: { reference: 1 } };
  assert.equal(isDuplicateKeyError(duplicate), true);
  assert.equal(isDuplicateKeyError(duplicate, "reference"), true);
  assert.equal(isDuplicateKeyError(duplicate, "email"), false);
  assert.equal(isDuplicateKeyError({ code: 11000 }, "reference"), false);
  assert.equal(isDuplicateKeyError({ code: 121 }), false);
  assert.equal(isDuplicateKeyError(null), false);
  assert.equal(isDuplicateKeyError(undefined, "reference"), false);
});

test("handleRouteError maps known failures to safe responses", (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  const cases = [
    [new HttpError(403, "Not allowed."), 403, { error: "Not allowed." }],
    [Object.assign(new Error("x"), { name: "ValidationError" }), 400, { error: "Invalid booking details." }],
    [Object.assign(new Error("x"), { name: "CastError" }), 400, { error: "Invalid booking details." }],
    [Object.assign(new Error("x"), { name: "VersionError" }), 409, { error: "This booking was updated by another request. Please retry." }],
    [Object.assign(new Error("dup"), { code: 11000 }), 409, { error: "This request conflicts with an existing record." }],
    [new Error("socket hang up"), 503, { error: "Service bookings are temporarily unavailable." }],
  ];
  for (const [error, status, body] of cases) {
    const response = fakeResponse();
    assert.equal(handleRouteError(response, error, "Create booking"), response);
    assert.equal(response.statusCode, status, error.name);
    assert.deepEqual(response.body, body);
  }
  assert.deepEqual(logged, [["Create booking request failed:", "Error"]]);
});

test("withTransaction runs work in a session and falls back without transactions", async () => {
  const calls = [];
  const session = {
    async withTransaction(fn) {
      calls.push("begin");
      await fn();
      calls.push("commit");
    },
    async endSession() {
      calls.push("end");
    },
  };
  const result = await withTransaction({ startSession: async () => session }, async (active) => {
    calls.push(active === session ? "work(session)" : "work(other)");
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(calls, ["begin", "work(session)", "commit", "end"]);

  const noSession = await withTransaction(
    { startSession: async () => { throw Object.assign(new Error("no"), { code: 20 }); } },
    async (active) => (active === null ? "standalone" : "session"),
  );
  assert.equal(noSession, "standalone");

  const ended = [];
  const unsupported = {
    async withTransaction() {
      throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
    },
    async endSession() {
      ended.push(true);
    },
  };
  assert.equal(await withTransaction({ startSession: async () => unsupported }, async (active) => active), null);
  assert.deepEqual(ended, [true]);

  const failing = { ...unsupported, async withTransaction() { throw new Error("write conflict"); } };
  await assert.rejects(withTransaction({ startSession: async () => failing }, async () => 1), /write conflict/);
  assert.deepEqual(ended, [true, true]);
  await assert.rejects(
    withTransaction({ startSession: async () => { throw new Error("pool closed"); } }, async () => 1),
    /pool closed/,
  );
});

test("bookingIdentifierFilter accepts ids and references with the right prefix", () => {
  const id = "507f1f77bcf86cd799439011";
  assert.ok(OBJECT_ID_PATTERN.test(id));
  assert.deepEqual(bookingIdentifierFilter(id), { _id: id });
  assert.deepEqual(bookingIdentifierFilter(" sb-20270102-abc2de "), { reference: "SB-20270102-ABC2DE" });
  assert.deepEqual(bookingIdentifierFilter("VS-20270102-ABCDEF", "VS"), { reference: "VS-20270102-ABCDEF" });
  assert.equal(bookingIdentifierFilter("VS-20270102-ABCDEF"), null);
  assert.equal(bookingIdentifierFilter("SB-20270102-ABCDE1"), null);
  assert.equal(bookingIdentifierFilter("SB-2027012-ABCDEF"), null);
  assert.equal(bookingIdentifierFilter(42), null);
});

test("saveWithUniqueReference retries reference collisions up to five times", async () => {
  const references = [];
  let failures = 2;
  const saved = await saveWithUniqueReference((reference) => ({
    reference,
    async save() {
      references.push(reference);
      if (failures-- > 0) throw { code: 11000, keyPattern: { reference: 1 } };
      return { saved: reference };
    },
  }), "VS");
  assert.equal(references.length, 3);
  assert.equal(saved.saved, references[2]);
  for (const reference of references) assert.match(reference, /^VS-\d{8}-[A-HJ-NP-Z2-9]{6}$/);

  let attempts = 0;
  await assert.rejects(
    saveWithUniqueReference(() => ({
      async save() {
        attempts += 1;
        throw Object.assign(new Error("dup"), { code: 11000, keyPattern: { reference: 1 } });
      },
    })),
    /dup/,
  );
  assert.equal(attempts, 5);

  attempts = 0;
  await assert.rejects(
    saveWithUniqueReference(() => ({
      async save() {
        attempts += 1;
        throw new Error("validation failed");
      },
    })),
    /validation failed/,
  );
  assert.equal(attempts, 1);
});

test("parseFutureServiceDate requires a real date after today in Manila", () => {
  // 20:00 UTC on 1 January is already 2 January in Manila (UTC+8).
  const now = new Date("2027-01-01T20:00:00.000Z");
  assert.deepEqual(parseFutureServiceDate("2027-01-03", { now }), { value: new Date("2027-01-03T00:00:00.000Z") });
  assert.deepEqual(parseFutureServiceDate("2027-01-02", { now }), { error: "Service date must be a future date." });
  assert.deepEqual(parseFutureServiceDate("2027-02-30", { now }), { error: "Service date is not a valid calendar date." });
  assert.deepEqual(parseFutureServiceDate("03/01/2027", { now }), { error: "Service date must use the YYYY-MM-DD format." });
  assert.deepEqual(parseFutureServiceDate(undefined, { now, label: "Visit date" }), {
    error: "Visit date must use the YYYY-MM-DD format.",
  });
});

test("parseCalendarDate, escapeRegExp and isWeekendDate", () => {
  assert.deepEqual(parseCalendarDate("2027-01-02"), new Date("2027-01-02T00:00:00.000Z"));
  assert.equal(parseCalendarDate("2027-13-01"), null);
  assert.equal(parseCalendarDate("2027-1-1"), null);
  assert.equal(parseCalendarDate(null), null);
  assert.equal(escapeRegExp("a.b*c(d)[e]$"), String.raw`a\.b\*c\(d\)\[e\]\$`);
  assert.equal(isWeekendDate(new Date("2027-01-02T00:00:00.000Z")), true);
  assert.equal(isWeekendDate(new Date("2027-01-03T00:00:00.000Z")), true);
  assert.equal(isWeekendDate(new Date("2027-01-04T00:00:00.000Z")), false);
});

test("isDateClosed asks for a closed record of the booking kind", async () => {
  const queries = [];
  const AvailableDate = {
    async exists(query) {
      queries.push(query);
      return query.bookingKind === "visit" ? { _id: 1 } : null;
    },
  };
  const date = new Date("2027-01-02T00:00:00.000Z");
  assert.equal(await isDateClosed(AvailableDate, "visit", date), true);
  assert.equal(await isDateClosed(AvailableDate, "service", date), false);
  assert.deepEqual(queries[0], { date, bookingKind: "visit", status: "Closed" });
});

const account = { firstName: "Juan", lastName: "Dela Cruz", phoneNumber: "09170000000", email: "Juan@Example.com" };

test("validateCustomerContact falls back to the account and normalizes values", () => {
  assert.deepEqual(validateCustomerContact({}, account), {
    value: { customerName: "Juan Dela Cruz", customerPhone: "09170000000", customerEmail: "juan@example.com" },
  });
  assert.deepEqual(
    validateCustomerContact({ customerName: " Ana ", customerPhone: "0917 123-4567", customerEmail: " ANA@X.PH " }, account),
    { value: { customerName: "Ana", customerPhone: "09171234567", customerEmail: "ana@x.ph" } },
  );
});

test("validateCustomerContact rejects invalid contact details", () => {
  assert.deepEqual(validateCustomerContact({ customerName: 5 }, account), { error: "Name must be text." });
  assert.deepEqual(validateCustomerContact({ customerName: "x".repeat(162) }, account), {
    error: "Name must be at most 161 characters.",
  });
  assert.deepEqual(validateCustomerContact({ customerPhone: "12345" }, account), {
    error: "Enter a valid contact number, such as 09XXXXXXXXX.",
  });
  assert.deepEqual(validateCustomerContact({ customerEmail: "not-an-email" }, account), {
    error: "Enter a valid email address.",
  });
  assert.deepEqual(validateCustomerContact({}, account, { emailRequired: true }), { error: "Email is required." });
  assert.deepEqual(validateCustomerContact({}, { firstName: "", lastName: "", phoneNumber: "09170000000", email: "a@b.co" }), {
    error: "Name is required.",
  });
});

test("parsePagination and paginationMeta", () => {
  assert.deepEqual(parsePagination({}), { value: { page: 1, limit: 10, skip: 0 } });
  assert.deepEqual(parsePagination({ page: "3", limit: "20" }), { value: { page: 3, limit: 20, skip: 40 } });
  assert.deepEqual(parsePagination({ page: "0" }), { error: "Page must be a positive whole number." });
  assert.deepEqual(parsePagination({ page: "1.5" }), { error: "Page must be a positive whole number." });
  assert.deepEqual(parsePagination({ limit: "51" }), { error: "Limit must be between 1 and 50." });
  assert.deepEqual(parsePagination({ limit: "abc" }), { error: "Limit must be between 1 and 50." });
  assert.deepEqual(paginationMeta({ page: 2, limit: 10 }, 21), { page: 2, limit: 10, total: 21, totalPages: 3 });
});

test("derivePaymentStatus reflects verified amounts", () => {
  assert.equal(derivePaymentStatus(0, 1000), "Unpaid");
  assert.equal(derivePaymentStatus(-5, 1000), "Unpaid");
  assert.equal(derivePaymentStatus(500, 1000), "Partially Paid");
  assert.equal(derivePaymentStatus(1000, 1000), "Paid");
});

const adminId = new mongoose.Types.ObjectId();
const booking = {
  _id: new mongoose.Types.ObjectId(),
  reference: "SB-20270102-ABCDEF",
  customer_id: new mongoose.Types.ObjectId(),
  serviceType: "Pond Package",
  packageSnapshot: {
    code: "pk1",
    name: "Pond Starter Package",
    description: "Starter",
    category: "Pond Package",
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    inclusions: ["Free kit"],
    price: decimal("6500.00"),
  },
  serviceDate: new Date("2027-01-02"),
  serviceLocation: "General Trias",
  customerName: "Juan",
  customerEmail: "juan@example.com",
  customerPhone: "09170000000",
  notes: "",
  customizationFee: decimal("0.00"),
  deliveryFee: decimal("250.00"),
  totalAmount: decimal("6750.00"),
  depositAmount: decimal("3375.00"),
  paidAmount: decimal("3375.00"),
  bookingStatus: "Confirmed",
  paymentStatus: "Partially Paid",
  deliveryFeeSetBy: adminId,
  deliveryFeeSetAt: new Date(5),
  statusHistory: [{ status: "Confirmed", changedBy: adminId, changedAt: new Date(3), note: "Paid" }],
  createdAt: new Date(1),
  updatedAt: new Date(2),
};

test("serializeBooking converts amounts and hides audit ids by default", () => {
  let options;
  const serialized = serializeBooking({ toObject: (opts) => { options = opts; return booking; } });
  assert.deepEqual(options, { depopulate: false });
  assert.equal(serialized.packageName, "Pond Starter Package");
  assert.equal(serialized.packagePrice, 6500);
  assert.equal(serialized.packageSnapshot.price, 6500);
  assert.notEqual(serialized.packageSnapshot.inclusions, booking.packageSnapshot.inclusions);
  assert.equal(serialized.deliveryFee, 250);
  assert.equal(serialized.totalAmount, 6750);
  assert.equal(serialized.balanceAmount, 3375);
  assert.equal(serialized.customConfiguration, null);
  assert.deepEqual(serialized.statusHistory, [{ status: "Confirmed", changedAt: new Date(3), note: "Paid" }]);
  assert.equal("deliveryFeeSetBy" in serialized, false);

  const audited = serializeBooking(booking, { includeAudit: true });
  assert.equal(audited.deliveryFeeSetBy, adminId);
  assert.equal(audited.statusHistory[0].changedBy, adminId);
});

test("serializeBooking names custom pond designs after the service type", () => {
  const custom = serializeBooking({
    ...booking,
    serviceType: "Custom Pond Design",
    packageSnapshot: null,
    customConfiguration: { layers: 2 },
    deliveryFeeSetBy: undefined,
    deliveryFeeSetAt: undefined,
  }, { includeAudit: true });
  assert.equal(custom.packageName, "Custom Pond Design");
  assert.equal(custom.packagePrice, 0);
  assert.equal(custom.packageSnapshot, null);
  assert.deepEqual(custom.customConfiguration, { layers: 2 });
  assert.equal(custom.deliveryFeeSetAt, null);
  assert.equal(custom.deliveryFeeSetBy, null);
});

test("serializePayment never exposes the receipt storage key", () => {
  const payment = {
    _id: new mongoose.Types.ObjectId(),
    service_booking_id: booking._id,
    paymentTarget: "deposit",
    amount: decimal("3375.00"),
    expectedAmount: decimal("3375.00"),
    gcashReference: "123",
    receiptFileName: "r.jpg",
    receiptStorageKey: "secret/key",
    status: "Verified",
    submittedAt: new Date(1),
    verifiedBy: adminId,
    verifiedAt: new Date(2),
    createdAt: new Date(1),
    updatedAt: new Date(2),
  };
  const serialized = serializePayment(payment);
  assert.equal(serialized.amount, 3375);
  assert.equal(serialized.rejectionReason, null);
  assert.equal("receiptStorageKey" in serialized, false);
  assert.equal("verifiedBy" in serialized, false);
  assert.equal(serializePayment(payment, { includeAudit: true }).verifiedBy, adminId);
  assert.equal(serializePayment({ ...payment, gcashReference: undefined, verifiedAt: undefined }).gcashReference, null);
});

test("bookingCents breaks a booking into integer centavos", () => {
  assert.deepEqual(bookingCents(booking), {
    packagePrice: 650_000,
    customizationFee: 0,
    deliveryFee: 25_000,
    total: 675_000,
    deposit: 337_500,
    paid: 337_500,
    balance: 337_500,
  });
  assert.equal(bookingCents({ ...booking, packageSnapshot: null }).packagePrice, 0);
});
