import mongoose, { type ClientSession, type Connection, type mongo } from "mongoose";

/**
 * Payment receipt storage backed by a GridFS bucket ("receipts") in the
 * application's existing MongoDB database and connection.
 */
const RECEIPT_BUCKET = "receipts";
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const RECEIPT_CONTENT_TYPES: readonly string[] = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
// Path separators and control characters are rejected in receipt names.
// eslint-disable-next-line no-control-regex -- matching control characters is the purpose
const UNSAFE_FILE_NAME_PATTERN = /[\\/\u0000-\u001f\u007f]/;

/** The booking and customer a receipt must belong to (ids or id strings). */
export interface ReceiptOwner {
  serviceBookingId: string | mongo.ObjectId;
  customerId: string | mongo.ObjectId;
}

/**
 * The connection's database. Storage is only used after connectMongoose()
 * has resolved, so the database is always present here.
 */
function connectedDb(connection: Connection): mongo.Db {
  return connection.db as mongo.Db;
}

function getReceiptBucket(connection: Connection): mongo.GridFSBucket {
  return new mongoose.mongo.GridFSBucket(connectedDb(connection), {
    bucketName: RECEIPT_BUCKET,
  });
}

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Confirms the file content matches its declared type. */
function contentMatchesType(buffer: Buffer, contentType: string): boolean {
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

function normalizeReceiptFileName(rawName: unknown): string {
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

async function storeReceipt(
  connection: Connection,
  buffer: Buffer,
  { fileName, contentType, metadata }: { fileName: string; contentType: string; metadata: Record<string, unknown> },
): Promise<mongo.ObjectId> {
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
  connection: Connection,
  storageKey: unknown,
  { serviceBookingId, customerId }: ReceiptOwner,
  session: ClientSession | null = null,
): Promise<mongo.WithId<mongo.GridFSFile> | null> {
  if (typeof storageKey !== "string" || !OBJECT_ID_PATTERN.test(storageKey)) {
    return null;
  }
  return connectedDb(connection).collection<mongo.GridFSFile>(`${RECEIPT_BUCKET}.files`).findOne(
    {
      _id: new mongoose.Types.ObjectId(storageKey),
      "metadata.serviceBookingId": new mongoose.Types.ObjectId(String(serviceBookingId)),
      "metadata.customerId": new mongoose.Types.ObjectId(String(customerId)),
    },
    session ? { session } : undefined,
  );
}

async function findReceiptFile(
  connection: Connection,
  storageKey: unknown,
): Promise<mongo.WithId<mongo.GridFSFile> | null> {
  if (typeof storageKey !== "string" || !OBJECT_ID_PATTERN.test(storageKey)) {
    return null;
  }
  return connectedDb(connection)
    .collection<mongo.GridFSFile>(`${RECEIPT_BUCKET}.files`)
    .findOne({ _id: new mongoose.Types.ObjectId(storageKey) });
}

function openReceiptDownload(connection: Connection, fileId: mongo.ObjectId): mongo.GridFSBucketReadStream {
  return getReceiptBucket(connection).openDownloadStream(fileId);
}

export {
  MAX_RECEIPT_BYTES,
  RECEIPT_CONTENT_TYPES,
  connectedDb,
  contentMatchesType,
  findOwnedReceipt,
  findReceiptFile,
  normalizeReceiptFileName,
  openReceiptDownload,
  storeReceipt,
};
