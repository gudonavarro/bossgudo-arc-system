import "dotenv/config";
import { closeMongo } from "../server/utils/mongodb";
import { getServicePackageModel } from "../server/models/service-package";
import { connectMongoose } from "../server/utils/mongoose";
import { seedServicePackages } from "../server/utils/service-package-seed";

async function main() {
  const connection = await connectMongoose({
    mongodbUri: process.env.MONGODB_URI || "",
    mongodbDatabase:
      process.env.MONGODB_DATABASE || "bossgudo_arc",
  });
  console.log(`Seeding service packages into database "${connection.name}".`);
  const ServicePackage = getServicePackageModel(connection);
  await ServicePackage.init();
  const { inserted, total } = await seedServicePackages(ServicePackage);
  console.log(
    inserted
      ? `Seeded ${inserted} of ${total} service packages.`
      : "All service packages already exist; nothing was changed.",
  );
}

main()
  .catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Service package seeding failed:", errorName);
    process.exitCode = 1;
  })
  .finally(closeMongo);
