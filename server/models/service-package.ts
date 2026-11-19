import { Schema, type Connection, type Model, type Types } from "mongoose";
import { toCents, type MoneyValue } from "../utils/money";

const PACKAGE_STATUSES = Object.freeze(["Active", "Inactive"] as const);
const PACKAGE_CATEGORIES = Object.freeze(["Pond Package"] as const);
const RESERVED_PACKAGE_NAMES: readonly string[] = Object.freeze(["custom pond design"]);
const PACKAGE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/;
const PACKAGE_LIMITS = Object.freeze({
  name: 70,
  description: 500,
  layers: 40,
  dimensions: 40,
  inclusion: 120,
  maxInclusions: 10,
});

export type PackageStatus = (typeof PACKAGE_STATUSES)[number];
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number];

/** Reference to a photo stored in the `package_images` GridFS bucket. */
export interface PackageImage {
  fileId: Types.ObjectId;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

export interface ServicePackage {
  code: string;
  name: string;
  nameKey: string;
  description: string;
  category: PackageCategory;
  price: Types.Decimal128;
  layers: string;
  dimensions: string;
  inclusions: string[];
  featured: boolean;
  sortOrder: number;
  status: PackageStatus;
  image: PackageImage | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

function normalizePackageName(name: unknown): string {
  return String(name ?? "").trim().replaceAll(/\s+/g, " ").toLowerCase();
}

const packageImageSchema = new Schema<PackageImage>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

const servicePackageSchema = new Schema<ServicePackage>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: PACKAGE_CODE_PATTERN,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: PACKAGE_LIMITS.name },
    // Case- and space-insensitive copy of the name, used for uniqueness.
    nameKey: { type: String, required: true },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: PACKAGE_LIMITS.description,
    },
    category: {
      type: String,
      enum: PACKAGE_CATEGORIES,
      required: true,
      default: "Pond Package",
    },
    price: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: {
        validator(value: unknown) {
          try {
            return toCents(value as MoneyValue) > 0;
          } catch {
            return false;
          }
        },
        message: "Package price must be greater than zero.",
      },
    },
    layers: { type: String, required: true, trim: true, maxlength: PACKAGE_LIMITS.layers },
    dimensions: {
      type: String,
      required: true,
      trim: true,
      maxlength: PACKAGE_LIMITS.dimensions,
    },
    inclusions: {
      type: [{ type: String, trim: true, maxlength: PACKAGE_LIMITS.inclusion }],
      validate: {
        validator: (items: string[]) =>
          items.length >= 1 &&
          items.length <= PACKAGE_LIMITS.maxInclusions &&
          items.every((item) => item.length > 0),
        message: `Provide between 1 and ${PACKAGE_LIMITS.maxInclusions} inclusions.`,
      },
    },
    featured: { type: Boolean, default: false },
    sortOrder: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "Sort order must be a whole number." },
    },
    status: { type: String, enum: PACKAGE_STATUSES, required: true, default: "Active" },
    image: { type: packageImageSchema, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, optimisticConcurrency: true },
);

servicePackageSchema.index({ code: 1 }, { unique: true });
servicePackageSchema.index({ nameKey: 1 }, { unique: true });
servicePackageSchema.index({ status: 1, sortOrder: 1 });
servicePackageSchema.index({ "image.fileId": 1 }, { sparse: true });

servicePackageSchema.pre("validate", function () {
  this.nameKey = normalizePackageName(this.name);
  if (RESERVED_PACKAGE_NAMES.includes(this.nameKey)) {
    this.invalidate("name", "That package name is reserved.");
  }
});

function getServicePackageModel(connection: Connection): Model<ServicePackage> {
  return (
    (connection.models.ServicePackage as Model<ServicePackage> | undefined) ??
    connection.model<ServicePackage>("ServicePackage", servicePackageSchema, "service_packages")
  );
}

export {
  PACKAGE_CATEGORIES,
  PACKAGE_CODE_PATTERN,
  PACKAGE_LIMITS,
  PACKAGE_STATUSES,
  RESERVED_PACKAGE_NAMES,
  getServicePackageModel,
  normalizePackageName,
  servicePackageSchema,
};
