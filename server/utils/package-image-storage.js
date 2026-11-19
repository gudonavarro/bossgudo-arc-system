import mongoose from "mongoose";
import { pipeline } from "node:stream/promises";
import { contentMatchesType } from "./receipt-storage.js";

/**
 * Package photo storage in the `package_images` GridFS bucket, separate from
 * payment receipts. Packages store only a reference to the file.
 */
const PACKAGE_IMAGE_BUCKET = "package_images";
const PACKAGE_IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
const MAX_PACKAGE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PACKAGE_IMAGE_DIMENSION = 1200;
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function getBucket(connection) {
  return new mongoose.mongo.GridFSBucket(connection.db, { bucketName: PACKAGE_IMAGE_BUCKET });
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (JPEG_SOF_MARKERS.has(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

function webpDimensions(buffer) {
  if (buffer.length < 30) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return null;
}

/** Reads pixel dimensions from the image header without decoding it. */
function imageDimensions(buffer, contentType) {
  try {
    if (contentType === "image/png") {
      return buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "IHDR"
        ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
        : null;
    }
    if (contentType === "image/jpeg") return jpegDimensions(buffer);
    if (contentType === "image/webp") return webpDimensions(buffer);
  } catch {
    return null;
  }
  return null;
}

/** Validates an uploaded photo; returns an error message or null. */
function validatePackageImage(buffer, contentType) {
  if (!PACKAGE_IMAGE_TYPES.includes(contentType)) {
    return "Upload the photo as a JPG, PNG or WEBP image.";
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return "Upload a photo file.";
  if (buffer.length > MAX_PACKAGE_IMAGE_BYTES) return "Photos must be 5 MB or smaller.";
  if (!contentMatchesType(buffer, contentType)) {
    return "The photo's content does not match its file type.";
  }
  const size = imageDimensions(buffer, contentType);
  if (!size || size.width < 1 || size.height < 1) return "The photo could not be read.";
  if (size.width > MAX_PACKAGE_IMAGE_DIMENSION || size.height > MAX_PACKAGE_IMAGE_DIMENSION) {
    return `Photos must be at most ${MAX_PACKAGE_IMAGE_DIMENSION} px on each side.`;
  }
  return null;
}

async function storePackageImage(connection, buffer, { contentType, code }) {
  const upload = getBucket(connection).openUploadStream(`${code}-photo`, {
    metadata: { packageCode: code, contentType },
  });
  await new Promise((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
    upload.end(buffer);
  });
  return upload.id;
}

/** Deletes a photo file only when no package references it any more. */
async function deletePackageImageIfUnreferenced(connection, ServicePackage, fileId) {
  if (!fileId) return false;
  if (await ServicePackage.exists({ "image.fileId": fileId })) return false;
  try {
    await getBucket(connection).delete(fileId);
    return true;
  } catch (error) {
    if (/FileNotFound|File not found/i.test(error?.message ?? "")) return false;
    throw error;
  }
}

/** Streams a package photo with safe headers. */
async function sendPackageImage(response, connection, pkg, { cacheControl }) {
  const file = await connection.db
    .collection(`${PACKAGE_IMAGE_BUCKET}.files`)
    .findOne({ _id: pkg.image.fileId });
  if (!file) {
    response.status(404).json({ error: "Photo not found." });
    return;
  }
  const contentType = PACKAGE_IMAGE_TYPES.includes(pkg.image.contentType)
    ? pkg.image.contentType
    : "application/octet-stream";
  response.set({
    "Content-Type": contentType,
    "Content-Length": String(file.length),
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl,
  });
  try {
    await pipeline(getBucket(connection).openDownloadStream(file._id), response);
  } catch (error) {
    // The browser cancelled the request (e.g. the image was re-rendered);
    // there is nobody left to answer, so this is not a server error.
    if (error?.code === "ERR_STREAM_PREMATURE_CLOSE" || response.destroyed) return;
    throw error;
  }
}

export {
  MAX_PACKAGE_IMAGE_BYTES,
  MAX_PACKAGE_IMAGE_DIMENSION,
  PACKAGE_IMAGE_BUCKET,
  PACKAGE_IMAGE_TYPES,
  deletePackageImageIfUnreferenced,
  imageDimensions,
  sendPackageImage,
  storePackageImage,
  validatePackageImage,
};
