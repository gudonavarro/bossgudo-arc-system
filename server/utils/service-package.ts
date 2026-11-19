import type { Model, Types } from "mongoose";
import { decimalToNumber, fromCents, parseAmountInput } from "./money";
import {
  PACKAGE_LIMITS,
  PACKAGE_STATUSES,
  RESERVED_PACKAGE_NAMES,
  normalizePackageName,
  type PackageStatus,
  type ServicePackage,
} from "../models/service-package";
import type { PackageSnapshot } from "../models/service-booking";

/** A validated value, or the message explaining why the input was rejected. */
export type FieldResult<T> =
  | { value: T; error?: never }
  | { error: string; value?: never };

/** Package fields an administrator may set through the API. */
export interface PackageInput {
  name?: string;
  description?: string;
  layers?: string;
  dimensions?: string;
  inclusions?: string[];
  price?: Types.Decimal128;
  featured?: boolean;
  status?: PackageStatus;
}

/** A stored package; audit fields may be populated with the staff user. */
export type StoredPackage = Omit<ServicePackage, "createdBy" | "updatedBy"> & {
  _id?: Types.ObjectId;
  createdBy?: unknown;
  updatedBy?: unknown;
};

type PackageSource = StoredPackage | { toObject(): StoredPackage };

// "custom" is the storefront's identifier for Custom Pond Design.
const RESERVED_PACKAGE_CODES = new Set(["custom"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(value: unknown, label: string, maxLength: number): FieldResult<string> {
  if (typeof value !== "string" || !value.trim()) {
    return { error: `${label} is required.` };
  }
  const text = value.trim();
  if (text.length > maxLength) {
    return { error: `${label} must be at most ${maxLength} characters.` };
  }
  return { value: text };
}

function readInclusions(value: unknown): FieldResult<string[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Add at least one inclusion." };
  }
  const items: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") return { error: "Each inclusion must be text." };
    const item = raw.trim();
    if (!item) continue;
    if (item.length > PACKAGE_LIMITS.inclusion) {
      return { error: `Each inclusion must be at most ${PACKAGE_LIMITS.inclusion} characters.` };
    }
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }
  if (items.length === 0) return { error: "Add at least one inclusion." };
  if (items.length > PACKAGE_LIMITS.maxInclusions) {
    return { error: `Add at most ${PACKAGE_LIMITS.maxInclusions} inclusions.` };
  }
  return { value: items };
}

type FieldReaders = {
  [Field in Exclude<keyof PackageInput, "status">]-?: (
    value: unknown,
  ) => FieldResult<NonNullable<PackageInput[Field]>>;
};

const FIELD_READERS: FieldReaders = {
  name: (value) => {
    const result = readText(value, "Package name", PACKAGE_LIMITS.name);
    if (result.error) return result;
    if (RESERVED_PACKAGE_NAMES.includes(normalizePackageName(result.value))) {
      return { error: "That package name is reserved." };
    }
    return result;
  },
  description: (value) => readText(value, "Description", PACKAGE_LIMITS.description),
  layers: (value) => readText(value, "Layers", PACKAGE_LIMITS.layers),
  dimensions: (value) => readText(value, "Dimensions", PACKAGE_LIMITS.dimensions),
  inclusions: readInclusions,
  price: (value) => {
    const amount = parseAmountInput(value);
    return amount.error
      ? { error: "Price must be greater than zero with at most two decimals." }
      : { value: fromCents(amount.value) };
  },
  featured: (value) =>
    typeof value === "boolean" ? { value } : { error: "Featured must be true or false." },
};

/**
 * Validates package details from an admin request. Only known fields are
 * read; codes, photos, order and audit fields cannot be set this way.
 */
function validatePackageInput(
  body: unknown,
  { partial = false }: { partial?: boolean } = {},
): FieldResult<PackageInput> {
  if (!isPlainObject(body)) return { error: "Provide package details." };
  const value: Record<string, unknown> = {};
  for (const [field, read] of Object.entries(FIELD_READERS) as [string, (value: unknown) => FieldResult<unknown>][]) {
    if (body[field] === undefined) {
      if (partial || field === "featured") continue;
      // Every reader rejects a missing value with its "required" message.
      return { error: read(undefined).error ?? "Provide package details." };
    }
    const result = read(body[field]);
    if (result.error) return { error: result.error };
    value[field] = result.value;
  }
  if (!partial) {
    if (body.status !== undefined && !(PACKAGE_STATUSES as readonly unknown[]).includes(body.status)) {
      return { error: "Status must be Active or Inactive." };
    }
    value.status = body.status ?? "Active";
  }
  if (partial && Object.keys(value).length === 0) {
    return { error: "Provide at least one package field to update." };
  }
  return { value: value as PackageInput };
}

/** Removes leading and trailing hyphens in linear time. */
function trimHyphens(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === "-") start += 1;
  while (end > start && text[end - 1] === "-") end -= 1;
  return text.slice(start, end);
}

function slugify(name: unknown): string {
  const slug = normalizePackageName(name)
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/g, "-");
  return trimHyphens(trimHyphens(slug).slice(0, 40)) || "package";
}

/** Generates a stable, unique public code from the package name. */
async function generatePackageCode(
  ServicePackage: Pick<Model<ServicePackage>, "exists">,
  name: unknown,
): Promise<string> {
  const base = slugify(name).length >= 2 ? slugify(name) : "package";
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const code = suffix === 1 ? base : `${base}-${suffix}`;
    if (RESERVED_PACKAGE_CODES.has(code)) continue;
    if (!(await ServicePackage.exists({ code }))) return code;
  }
  throw new Error("Could not generate a package code.");
}

/** Staff name only; never ids or contact details. */
function staffSummary(user: unknown): { firstName: unknown; lastName: unknown } | null {
  if (!user || typeof user !== "object") return null;
  const staff = user as { firstName?: unknown; lastName?: unknown };
  return staff.firstName === undefined
    ? null
    : { firstName: staff.firstName, lastName: staff.lastName };
}

/** Versioned photo link; the version changes whenever the photo changes. */
function packageImageUrl(
  pkg: Pick<StoredPackage, "code" | "image">,
  { admin = false }: { admin?: boolean } = {},
): string | null {
  if (!pkg.image?.fileId || !pkg.image.uploadedAt) return null;
  const base = admin ? "/api/admin/service-packages" : "/api/service-packages";
  const version = new Date(pkg.image.uploadedAt).getTime();
  return `${base}/${encodeURIComponent(pkg.code)}/image?v=${version}`;
}

function toPlain(document: PackageSource): StoredPackage {
  return "toObject" in document && typeof document.toObject === "function"
    ? document.toObject()
    : (document as StoredPackage);
}

/** Package fields safe for anyone choosing a package (no ids or audit data). */
function serializePublicPackage(document: PackageSource) {
  const pkg = toPlain(document);
  return {
    code: pkg.code,
    name: pkg.name,
    description: pkg.description,
    category: pkg.category,
    price: decimalToNumber(pkg.price),
    layers: pkg.layers,
    dimensions: pkg.dimensions,
    inclusions: [...(pkg.inclusions ?? [])],
    featured: Boolean(pkg.featured),
    imageUrl: packageImageUrl(pkg),
  };
}

function serializeAdminPackage(document: PackageSource) {
  const pkg = toPlain(document);
  return {
    ...serializePublicPackage(pkg),
    imageUrl: packageImageUrl(pkg, { admin: true }),
    image: pkg.image
      ? { contentType: pkg.image.contentType, size: pkg.image.size, uploadedAt: pkg.image.uploadedAt }
      : null,
    sortOrder: pkg.sortOrder,
    status: pkg.status,
    createdBy: staffSummary(pkg.createdBy),
    updatedBy: staffSummary(pkg.updatedBy),
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

/** Booking-time copy of a package; later catalog edits never change it. */
function packageSnapshot(
  pkg: Omit<PackageSnapshot, "inclusions"> & { inclusions?: string[] },
): PackageSnapshot {
  return {
    code: pkg.code,
    name: pkg.name,
    description: pkg.description,
    category: pkg.category,
    layers: pkg.layers,
    dimensions: pkg.dimensions,
    inclusions: [...(pkg.inclusions ?? [])],
    price: pkg.price,
  };
}

export {
  generatePackageCode,
  packageImageUrl,
  packageSnapshot,
  serializeAdminPackage,
  serializePublicPackage,
  validatePackageInput,
};
