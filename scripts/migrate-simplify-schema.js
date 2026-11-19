import "dotenv/config";
import { closeMongo } from "../server/utils/mongodb";
import { connectMongoose } from "../server/utils/mongoose";
import { migrateToSimplifiedSchema } from "../server/utils/simplify-schema-migration.js";

// Usage: npm run migrate:simplify-schema [-- --dry-run]
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const connection = await connectMongoose({
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase: process.env.MONGODB_DATABASE || "bossgudo_arc",
  });
  console.log(
    `${dryRun ? "Dry run: checking" : "Updating"} records for the simplified schema in database "${connection.name}".`,
  );
  const report = await migrateToSimplifiedSchema(connection.db, { dryRun });
  const verb = dryRun ? "would" : "did";

  for (const item of report.snapshotsAdded) {
    console.log(`  ${dryRun ? "would add" : "added"} package snapshot to ${item.reference} → ${item.code}`);
  }
  console.log(`Bookings ${verb} drop old price/balance fields: ${report.bookingsCleaned}`);
  console.log(`Payments ${verb} drop the method field: ${report.paymentsCleaned}`);
  for (const item of report.needsReview) {
    console.log(`  NEEDS REVIEW ${item.reference}: ${item.reason}`);
  }
  if (report.paymentsWithoutReference) {
    console.log(`  NEEDS REVIEW: ${report.paymentsWithoutReference} payment(s) have no GCash reference.`);
  }
}

main()
  .catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Schema simplification migration failed:", errorName);
    process.exitCode = 1;
  })
  .finally(closeMongo);
