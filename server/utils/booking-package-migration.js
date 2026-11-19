import { fromCents, toCents } from "./money.js";
import { INITIAL_SERVICE_PACKAGES } from "./service-package-seed.js";

const MISSING_SNAPSHOT = { $or: [{ packageSnapshot: null }, { packageSnapshot: { $exists: false } }] };

/**
 * Adds the missing package snapshot to package bookings made before the
 * catalog moved to MongoDB. Those bookings were priced from the former
 * hard-coded catalog, so a booking is migrated only when its stored package
 * name AND agreed price match one of those definitions. Only the missing
 * `packageSnapshot` field is written; existing snapshots, prices, statuses
 * and timestamps are never changed, so the migration can be re-run safely.
 */
async function migrateBookingPackageSnapshots(ServiceBooking, { dryRun = false } = {}) {
  const candidates = await ServiceBooking.find({ serviceType: "Pond Package", ...MISSING_SNAPSHOT })
    .select("reference packageNameSnapshot packagePrice")
    .lean();
  const report = { candidates: candidates.length, updated: [], skipped: [] };

  for (const booking of candidates) {
    const agreedCents = toCents(booking.packagePrice);
    const definition = INITIAL_SERVICE_PACKAGES.find(
      (item) => item.name === booking.packageNameSnapshot && item.priceCents === agreedCents,
    );
    if (!definition) {
      report.skipped.push({ reference: booking.reference, reason: "No matching original package and price." });
      continue;
    }
    if (dryRun) {
      report.updated.push({ reference: booking.reference, code: definition.code, dryRun: true });
      continue;
    }
    const result = await ServiceBooking.updateOne(
      { _id: booking._id, serviceType: "Pond Package", ...MISSING_SNAPSHOT },
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
      { timestamps: false },
    );
    if (result.modifiedCount === 1) {
      report.updated.push({ reference: booking.reference, code: definition.code });
    }
  }
  return report;
}

export { migrateBookingPackageSnapshots };
