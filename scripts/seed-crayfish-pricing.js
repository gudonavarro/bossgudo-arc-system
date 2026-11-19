import "dotenv/config";
import { closeMongo } from "../server/utils/mongodb";
import { getFaqModel } from "../server/models/faq.js";
import { connectMongoose } from "../server/utils/mongoose";
import { seedCrayfishPricingFaq } from "../server/utils/faq-seed.js";

async function main() {
  const connection = await connectMongoose({
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "bossgudo_arc",
  });
  const inserted = await seedCrayfishPricingFaq(getFaqModel(connection));
  console.log(
    inserted
      ? "Seeded the crayfish pricing FAQ."
      : "Crayfish pricing FAQ already exists; no changes made.",
  );
}

main()
  .catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("FAQ seeding failed:", errorName);
    process.exitCode = 1;
  })
  .finally(closeMongo);
