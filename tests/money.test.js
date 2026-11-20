const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  centsToNumber,
  decimalToNumber,
  depositFor,
  fromCents,
  isNonNegativeDecimal,
  parseAmountInput,
  toCents,
} = jiti("../server/utils/money");

const decimal = (text) => mongoose.Types.Decimal128.fromString(text);

test("toCents reads numbers, numeric text and Decimal128 as integer centavos", () => {
  assert.equal(toCents(null), 0);
  assert.equal(toCents(undefined), 0);
  assert.equal(toCents(12.5), 1250);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents("12.34"), 1234);
  assert.equal(toCents(" 7 "), 700);
  assert.equal(toCents("-1.5"), -150);
  assert.equal(toCents(decimal("99.99")), 9999);
});

test("toCents rejects malformed monetary values", () => {
  assert.throws(() => toCents("abc"), TypeError);
  assert.throws(() => toCents("1.234"), TypeError);
  assert.throws(() => toCents(""), TypeError);
});

test("fromCents builds a two-decimal Decimal128 and rejects non-integers", () => {
  assert.equal(fromCents(1250).toString(), "12.50");
  assert.equal(fromCents(5).toString(), "0.05");
  assert.equal(fromCents(-5).toString(), "-0.05");
  assert.equal(fromCents(0).toString(), "0.00");
  assert.ok(fromCents(100) instanceof mongoose.Types.Decimal128);
  assert.throws(() => fromCents(1.5), TypeError);
  assert.throws(() => fromCents(Number.NaN), TypeError);
});

test("centsToNumber and decimalToNumber convert to pesos", () => {
  assert.equal(centsToNumber(1234), 12.34);
  assert.equal(decimalToNumber(decimal("10.00")), 10);
  assert.equal(decimalToNumber("3.50"), 3.5);
  assert.equal(decimalToNumber(null), null);
  assert.equal(decimalToNumber(undefined), undefined);
});

test("parseAmountInput accepts positive amounts with up to two decimals", () => {
  assert.deepEqual(parseAmountInput(100), { value: 10000 });
  assert.deepEqual(parseAmountInput("99.99"), { value: 9999 });
  assert.deepEqual(parseAmountInput(" 12 "), { value: 1200 });
  assert.deepEqual(parseAmountInput("100000000"), { value: 10_000_000_000 });
});

test("parseAmountInput rejects zero, negatives, extra decimals and non-numbers", () => {
  for (const value of [0, "0", "-1", "1.234", "abc", "", Infinity, Number.NaN, null, undefined, {}, "100000000.01"]) {
    assert.deepEqual(parseAmountInput(value), { error: true }, `value ${String(value)}`);
  }
  assert.deepEqual(parseAmountInput("0", { allowZero: true }), { value: 0 });
  assert.deepEqual(parseAmountInput(0, { allowZero: true }), { value: 0 });
});

test("depositFor rounds a 50% deposit up to the nearest centavo", () => {
  assert.equal(depositFor(1000), 500);
  assert.equal(depositFor(1001), 501);
  assert.equal(depositFor(0), 0);
});

test("isNonNegativeDecimal accepts empty and non-negative values only", () => {
  assert.equal(isNonNegativeDecimal(null), true);
  assert.equal(isNonNegativeDecimal(undefined), true);
  assert.equal(isNonNegativeDecimal(decimal("0.00")), true);
  assert.equal(isNonNegativeDecimal(decimal("5.25")), true);
  assert.equal(isNonNegativeDecimal(decimal("-1.00")), false);
  assert.equal(isNonNegativeDecimal("abc"), false);
});
