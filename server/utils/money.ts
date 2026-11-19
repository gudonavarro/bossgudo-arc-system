import mongoose, { type Types } from "mongoose";

const { Decimal128 } = mongoose.Types;
const MAX_CENTS = 100_000_000_00;
const DECIMAL_TEXT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** A stored or submitted amount: Decimal128, pesos as a number, or numeric text. */
export type MoneyValue = Types.Decimal128 | number | string | null | undefined;

/** Result of parsing a client-supplied amount; `value` is in centavos. */
export type AmountInputResult =
  | { value: number; error?: never }
  | { error: true; value?: never };

/**
 * Converts a stored Decimal128, number, or numeric string into integer
 * centavos. All booking arithmetic is done on integers to avoid floating
 * point drift.
 */
function toCents(value: MoneyValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const text = typeof value === "number" ? value.toFixed(2) : String(value);
  const match = DECIMAL_TEXT_PATTERN.exec(text.trim());
  if (!match) {
    throw new TypeError("Invalid monetary value.");
  }
  const [, sign, whole, fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

function fromCents(cents: number): Types.Decimal128 {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("Invalid monetary value.");
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return Decimal128.fromString(`${sign}${whole}.${fraction}`);
}

function centsToNumber(cents: number): number {
  return cents / 100;
}

function decimalToNumber(value: null): null;
function decimalToNumber(value: undefined): undefined;
function decimalToNumber(value: Types.Decimal128 | number | string): number;
function decimalToNumber(value: MoneyValue): number | null | undefined;
function decimalToNumber(value: MoneyValue): number | null | undefined {
  return value === null || value === undefined
    ? value
    : centsToNumber(toCents(value));
}

/**
 * Parses a client-supplied amount. Accepts non-negative numbers or numeric
 * strings with at most two decimal places and returns integer centavos.
 */
function parseAmountInput(
  value: unknown,
  { allowZero = false }: { allowZero?: boolean } = {},
): AmountInputResult {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { error: true };
    text = String(value);
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    return { error: true };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    return { error: true };
  }
  const cents = toCents(text);
  if (cents > MAX_CENTS || (!allowZero && cents === 0)) {
    return { error: true };
  }
  return { value: cents };
}

/** Required 50% deposit, rounded up to the nearest centavo. */
function depositFor(totalCents: number): number {
  return Math.ceil(totalCents / 2);
}

/** Schema validator: true for empty or non-negative amounts. */
function isNonNegativeDecimal(value: unknown): boolean {
  try {
    return (
      value === null ||
      value === undefined ||
      toCents(value as MoneyValue) >= 0
    );
  } catch {
    return false;
  }
}

export {
  centsToNumber,
  decimalToNumber,
  depositFor,
  fromCents,
  isNonNegativeDecimal,
  parseAmountInput,
  toCents,
};
