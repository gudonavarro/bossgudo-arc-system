import mongoose from "mongoose";

/**
 * Payment receipt storage backed by a GridFS bucket ("receipts") in the
 * application's existing MongoDB database and connection.
 */
const RECEIPT_BUCKET = "receipts";
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const RECEIPT_CONTENT_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const UNSAFE_FILE_NAME_PATTERN = /[\\/\u0000-\u001f\u007f]/;

function getReceiptBucket(connection) {
  return new mongoose.mongo.GridFSBucket(connection.db, {
    bucketName: RECEIPT_BUCKET,
  });
}

function startsWithBytes(buffer, bytes, offset = 0) {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Confirms the file content matches its declared type. */
function contentMatchesType(buffer, contentType) {
  switch (contentType) {
    case "image/jpeg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      return (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    case "image/heic":
    case "image/heif":
      return buffer.toString("ascii", 4, 8) === "ftyp";
    case "application/pdf":
      return buffer.toString("ascii", 0, 5) === "%PDF-";
    default:
      return false;
  }
}

function normalizeReceiptFileName(rawName) {
  let name = "";
  if (typeof rawName === "string") {
    try {
      name = decodeURIComponent(rawName).trim();
    } catch {
      name = "";
    }
  }
  if (!name || name.length > 255 || UNSAFE_FILE_NAME_PATTERN.test(name)) {
    return "receipt";
  }
  return name;
}

async function storeReceipt(connection, buffer, { fileName, contentType, metadata }) {
  const upload = getReceiptBucket(connection).openUploadStream(fileName, {
    metadata: { ...metadata, contentType },
  });
  await new Promise((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
    upload.end(buffer);
  });
  return upload.id;
}

/** Returns the stored receipt file document when the owner matches. */
async function findOwnedReceipt(
  connection,
  storageKey,
  { serviceBookingId, customerId },
  session = null,
) {
  if (typeof storageKey !== "string" || !OBJECT_ID_PATTERN.test(storageKey)) {
    return null;
  }
  return connection.db.collection(`${RECEIPT_BUCKET}.files`).findOne(
    {
      _id: new mongoose.Types.ObjectId(storageKey),
      "metadata.serviceBookingId": new mongoose.Types.ObjectId(String(serviceBookingId)),
      "metadata.customerId": new mongoose.Types.ObjectId(String(customerId)),
    },
    session ? { session } : undefined,
  );
}

async function findReceiptFile(connection, storageKey) {
  if (typeof storageKey !== "string" || !OBJECT_ID_PATTERN.test(storageKey)) {
    return null;
  }
  return connection.db
    .collection(`${RECEIPT_BUCKET}.files`)
    .findOne({ _id: new mongoose.Types.ObjectId(storageKey) });
}

function openReceiptDownload(connection, fileId) {
  return getReceiptBucket(connection).openDownloadStream(fileId);
}

export {
  MAX_RECEIPT_BYTES,
  RECEIPT_CONTENT_TYPES,
  contentMatchesType,
  findOwnedReceipt,
  findReceiptFile,
  normalizeReceiptFileName,
  openReceiptDownload,
  storeReceipt,
};
