import { decimalToNumber, fromCents, parseAmountInput } from "./money";
import {
  PACKAGE_LIMITS,
  PACKAGE_STATUSES,
  RESERVED_PACKAGE_NAMES,
  normalizePackageName,
} from "../models/service-package";

// "custom" is the storefront's identifier for Custom Pond Design.
const RESERVED_PACKAGE_CODES = new Set(["custom"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: `${label} is required.` };
  }
  const text = value.trim();
  if (text.length > maxLength) {
    return { error: `${label} must be at most ${maxLength} characters.` };
  }
  return { value: text };
}

function readInclusions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Add at least one inclusion." };
  }
  const items = [];
  const seen = new Set();
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

const FIELD_READERS = {
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
function validatePackageInput(body, { partial = false } = {}) {
  if (!isPlainObject(body)) return { error: "Provide package details." };
  const value = {};
  for (const [field, read] of Object.entries(FIELD_READERS)) {
    if (body[field] === undefined) {
      if (partial || field === "featured") continue;
      return read(undefined);
    }
    const result = read(body[field]);
    if (result.error) return result;
    value[field] = result.value;
  }
  if (!partial) {
    if (body.status !== undefined && !PACKAGE_STATUSES.includes(body.status)) {
      return { error: "Status must be Active or Inactive." };
    }
    value.status = body.status ?? "Active";
  }
  if (partial && Object.keys(value).length === 0) {
    return { error: "Provide at least one package field to update." };
  }
  return { value };
}

function slugify(name) {
  return (
    normalizePackageName(name)
      .normalize("NFKD")
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 40)
      .replaceAll(/-+$/g, "") || "package"
  );
}

/** Generates a stable, unique public code from the package name. */
async function generatePackageCode(ServicePackage, name) {
  const base = slugify(name).length >= 2 ? slugify(name) : "package";
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const code = suffix === 1 ? base : `${base}-${suffix}`;
    if (RESERVED_PACKAGE_CODES.has(code)) continue;
    if (!(await ServicePackage.exists({ code }))) return code;
  }
  throw new Error("Could not generate a package code.");
}

function staffSummary(user) {
  return user && typeof user === "object" && user.firstName !== undefined
    ? { firstName: user.firstName, lastName: user.lastName }
    : null;
}

/** Versioned photo link; the version changes whenever the photo changes. */
function packageImageUrl(pkg, { admin = false } = {}) {
  if (!pkg.image?.fileId || !pkg.image.uploadedAt) return null;
  const base = admin ? "/api/admin/service-packages" : "/api/service-packages";
  const version = new Date(pkg.image.uploadedAt).getTime();
  return `${base}/${encodeURIComponent(pkg.code)}/image?v=${version}`;
}

function toPlain(document) {
  return typeof document?.toObject === "function" ? document.toObject() : document;
}

/** Package fields safe for anyone choosing a package (no ids or audit data). */
function serializePublicPackage(document) {
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

function serializeAdminPackage(document) {
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
function packageSnapshot(pkg) {
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
