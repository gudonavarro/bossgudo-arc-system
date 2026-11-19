import "dotenv/config";
import { closeMongo } from "../server/utils/mongodb";
import { getServiceBookingModel } from "../server/models/service-booking.js";
import { connectMongoose } from "../server/utils/mongoose";
import { migrateBookingPackageSnapshots } from "../server/utils/booking-package-migration.js";

// Usage: npm run migrate:package-snapshots [-- --dry-run]
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const connection = await connectMongoose({
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "bossgudo_arc",
  });
  console.log(
    `${dryRun ? "Dry run: checking" : "Adding"} missing booking package snapshots in database "${connection.name}".`,
  );
  const report = await migrateBookingPackageSnapshots(getServiceBookingModel(connection), { dryRun });
  console.log(`Bookings without a package snapshot: ${report.candidates}`);
  for (const item of report.updated) {
    console.log(`  ${dryRun ? "would update" : "updated"} ${item.reference} → ${item.code}`);
  }
  for (const item of report.skipped) {
    console.log(`  skipped ${item.reference}: ${item.reason}`);
  }
  if (!report.candidates) console.log("Nothing to migrate.");
}

main()
  .catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Booking package snapshot migration failed:", errorName);
    process.exitCode = 1;
  })
  .finally(closeMongo);
