const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);
const {
  MAX_RECEIPT_BYTES,
  RECEIPT_CONTENT_TYPES,
  contentMatchesType,
  normalizeReceiptFileName,
} = jiti("../server/utils/receipt-storage");
const {
  MAX_PACKAGE_IMAGE_BYTES,
  MAX_PACKAGE_IMAGE_DIMENSION,
  PACKAGE_IMAGE_BUCKET,
  PACKAGE_IMAGE_TYPES,
  imageDimensions,
  validatePackageImage,
} = jiti("../server/utils/package-image-storage");

const logoPng = readFileSync(path.join(__dirname, "../public/images/boss-gudo-logo.png"));

function png(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** SOI, an APP0 segment, a 0xFF fill byte, then a baseline SOF0 frame header. */
function jpeg(width, height) {
  const app0 = Buffer.alloc(18);
  app0.writeUInt16BE(0xffe0, 0);
  app0.writeUInt16BE(16, 2);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, Buffer.from([0xff]), sof]);
}

function webp(chunk, write) {
  const buffer = Buffer.alloc(40);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(32, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write(chunk, 12, "ascii");
  write(buffer);
  return buffer;
}

test("receipt limits and accepted types are unchanged", () => {
  assert.equal(MAX_RECEIPT_BYTES, 8 * 1024 * 1024);
  assert.deepEqual([...RECEIPT_CONTENT_TYPES], ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);
  assert.ok(Object.isFrozen(RECEIPT_CONTENT_TYPES));
  assert.equal(MAX_PACKAGE_IMAGE_BYTES, 5 * 1024 * 1024);
  assert.equal(MAX_PACKAGE_IMAGE_DIMENSION, 1200);
  assert.equal(PACKAGE_IMAGE_BUCKET, "package_images");
  assert.deepEqual([...PACKAGE_IMAGE_TYPES], ["image/jpeg", "image/png", "image/webp"]);
});

test("contentMatchesType checks each format's signature", () => {
  assert.equal(contentMatchesType(jpeg(10, 10), "image/jpeg"), true);
  assert.equal(contentMatchesType(logoPng, "image/png"), true);
  assert.equal(contentMatchesType(webp("VP8X", () => {}), "image/webp"), true);
  const heic = Buffer.from("\0\0\0\x18ftypheic", "binary");
  assert.equal(contentMatchesType(heic, "image/heic"), true);
  assert.equal(contentMatchesType(heic, "image/heif"), true);
  assert.equal(contentMatchesType(Buffer.from("%PDF-1.7\n"), "application/pdf"), true);

  assert.equal(contentMatchesType(logoPng, "image/jpeg"), false);
  assert.equal(contentMatchesType(jpeg(10, 10), "image/png"), false);
  assert.equal(contentMatchesType(Buffer.from("RIFF0000WAVE"), "image/webp"), false);
  assert.equal(contentMatchesType(Buffer.from("%PDF"), "application/pdf"), false);
  assert.equal(contentMatchesType(Buffer.from("<svg/>"), "image/svg+xml"), false);
  assert.equal(contentMatchesType(Buffer.alloc(0), "image/png"), false);
});

test("normalizeReceiptFileName decodes safe names and replaces unsafe ones", () => {
  assert.equal(normalizeReceiptFileName("gcash.png"), "gcash.png");
  assert.equal(normalizeReceiptFileName("  my%20receipt.png  "), "my receipt.png");
  assert.equal(normalizeReceiptFileName("resibo-ñ.jpg"), "resibo-ñ.jpg");
  for (const unsafe of ["%E0%A4%A", "../etc/passwd", "a\\b.png", "a%2Fb.png", "bad\u0007.png", "x\u007f", "", "   ", "a".repeat(256), undefined, 42]) {
    assert.equal(normalizeReceiptFileName(unsafe), "receipt", JSON.stringify(unsafe));
  }
  assert.equal(normalizeReceiptFileName("a".repeat(255)), "a".repeat(255));
});

test("imageDimensions reads PNG, JPEG and WEBP headers", () => {
  assert.deepEqual(imageDimensions(logoPng, "image/png"), { width: 500, height: 500 });
  assert.deepEqual(imageDimensions(png(640, 480), "image/png"), { width: 640, height: 480 });
  assert.equal(imageDimensions(png(1, 1).subarray(0, 20), "image/png"), null);
  assert.deepEqual(imageDimensions(jpeg(800, 600), "image/jpeg"), { width: 800, height: 600 });
  assert.equal(imageDimensions(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg"), null);

  const lossy = webp("VP8 ", (b) => {
    b.writeUInt16LE(320 | 0x4000, 26);
    b.writeUInt16LE(240, 28);
  });
  assert.deepEqual(imageDimensions(lossy, "image/webp"), { width: 320, height: 240 });
  const lossless = webp("VP8L", (b) => b.writeUInt32LE((100 - 1) | ((50 - 1) << 14), 21));
  assert.deepEqual(imageDimensions(lossless, "image/webp"), { width: 100, height: 50 });
  const extended = webp("VP8X", (b) => {
    b.writeUIntLE(1199, 24, 3);
    b.writeUIntLE(799, 27, 3);
  });
  assert.deepEqual(imageDimensions(extended, "image/webp"), { width: 1200, height: 800 });
  assert.equal(imageDimensions(webp("ALPH", () => {}), "image/webp"), null);
  assert.equal(imageDimensions(Buffer.alloc(10), "image/webp"), null);
  assert.equal(imageDimensions(logoPng, "image/gif"), null);
});

test("validatePackageImage explains every rejection", () => {
  assert.equal(validatePackageImage(logoPng, "image/png"), null);
  assert.equal(validatePackageImage(jpeg(1200, 1200), "image/jpeg"), null);
  assert.equal(validatePackageImage(logoPng, "image/gif"), "Upload the photo as a JPG, PNG or WEBP image.");
  assert.equal(validatePackageImage(Buffer.alloc(0), "image/png"), "Upload a photo file.");
  assert.equal(validatePackageImage("not a buffer", "image/png"), "Upload a photo file.");
  assert.equal(validatePackageImage(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"), "Photos must be 5 MB or smaller.");
  assert.equal(validatePackageImage(jpeg(10, 10), "image/png"), "The photo's content does not match its file type.");
  assert.equal(validatePackageImage(png(0, 10), "image/png"), "The photo could not be read.");
  assert.equal(validatePackageImage(png(10, 10).subarray(0, 12), "image/png"), "The photo could not be read.");
  assert.equal(validatePackageImage(png(1201, 10), "image/png"), "Photos must be at most 1200 px on each side.");
  assert.equal(validatePackageImage(jpeg(10, 1300), "image/jpeg"), "Photos must be at most 1200 px on each side.");
});
