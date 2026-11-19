import "dotenv/config";
import { closeMongo } from "../server/utils/mongodb";
import { getFaqModel } from "../server/models/faq.js";
import { connectMongoose } from "../server/utils/mongoose";
import { seedContactLocationFaq } from "../server/utils/faq-seed.js";

async function main() {
  const connection = await connectMongoose({
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "bossgudo_arc",
  });
  const inserted = await seedContactLocationFaq(getFaqModel(connection));
  console.log(
    inserted
      ? "Seeded the farm contact FAQ."
      : "Farm contact FAQ already exists; no duplicate was created.",
  );
}

main()
  .catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Farm contact FAQ seeding failed:", errorName);
    process.exitCode = 1;
  })
  .finally(closeMongo);
