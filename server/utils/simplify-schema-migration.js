import { fromCents, toCents } from "./money";
import { INITIAL_SERVICE_PACKAGES } from "./service-package-seed.js";

const REMOVED_BOOKING_FIELDS = ["packageNameSnapshot", "packagePrice", "balanceAmount"];
const MISSING_SNAPSHOT = { $or: [{ packageSnapshot: null }, { packageSnapshot: { $exists: false } }] };

/**
 * Brings existing records in line with the simplified schema:
 *
 * 1. Package bookings made before the catalog moved to MongoDB get the
 *    `packageSnapshot` they are missing, when their stored package name AND
 *    agreed price match one of the original package definitions.
 * 2. Bookings drop `packageNameSnapshot` and `packagePrice` (both now come
 *    from `packageSnapshot`) and `balanceAmount` (always total - paid).
 *    A package booking that still has no snapshot keeps those fields, so no
 *    information is lost; it is reported for manual review instead.
 * 3. Payments drop `method`, since GCash is the only payment method.
 *
 * It works on the raw collections because the removed fields are no longer
 * in the Mongoose schemas. Safe to re-run.
 */
async function migrateToSimplifiedSchema(db, { dryRun = false } = {}) {
  const bookings = db.collection("service_bookings");
  const payments = db.collection("payments");
  const report = { snapshotsAdded: [], needsReview: [], bookingsCleaned: 0, paymentsCleaned: 0 };

  const missing = await bookings
    .find({ serviceType: "Pond Package", ...MISSING_SNAPSHOT })
    .project({ reference: 1, packageNameSnapshot: 1, packagePrice: 1 })
    .toArray();

  for (const booking of missing) {
    const agreedCents = booking.packagePrice == null ? null : toCents(booking.packagePrice);
    const definition = INITIAL_SERVICE_PACKAGES.find(
      (item) => item.name === booking.packageNameSnapshot && item.priceCents === agreedCents,
    );
    if (!definition) {
      report.needsReview.push({
        reference: booking.reference,
        reason: "No matching original package and price; old fields kept.",
      });
      continue;
    }
    report.snapshotsAdded.push({ reference: booking.reference, code: definition.code });
    if (dryRun) continue;
    await bookings.updateOne(
      { _id: booking._id, ...MISSING_SNAPSHOT },
      {
        $set: {
          packageSnapshot: {
            code: definition.code,
            name: definition.name,
            description: definition.description,
            category: "Pond Package",
            layers: definition.layers,
            dimensions: definition.dimensions,
            inclusions: [...definition.inclusions],
            // The agreed price stored on the booking, not the current catalog price.
            price: fromCents(agreedCents),
          },
        },
      },
    );
  }

  const cleanableBookings = {
    $and: [
      { $or: REMOVED_BOOKING_FIELDS.map((field) => ({ [field]: { $exists: true } })) },
      { $or: [{ serviceType: "Custom Pond Design" }, { packageSnapshot: { $type: "object" } }] },
    ],
  };
  const stalePayments = { method: { $exists: true } };

  if (dryRun) {
    report.bookingsCleaned = await bookings.countDocuments(cleanableBookings);
    report.paymentsCleaned = await payments.countDocuments(stalePayments);
  } else {
    const unsetBooking = Object.fromEntries(REMOVED_BOOKING_FIELDS.map((field) => [field, ""]));
    report.bookingsCleaned = (await bookings.updateMany(cleanableBookings, { $unset: unsetBooking }))
      .modifiedCount;
    report.paymentsCleaned = (await payments.updateMany(stalePayments, { $unset: { method: "" } }))
      .modifiedCount;
  }

  report.paymentsWithoutReference = await payments.countDocuments({
    $or: [{ gcashReference: { $exists: false } }, { gcashReference: null }, { gcashReference: "" }],
  });
  return report;
}

export { migrateToSimplifiedSchema };
