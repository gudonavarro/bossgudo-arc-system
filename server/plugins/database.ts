import { defineNitroPlugin } from "nitropack/runtime";
import { closeMongo, connectMongo } from "../utils/mongodb";

export default defineNitroPlugin(async (nitroApp) => {
  const { mongodbUri, mongodbDatabase } = useRuntimeConfig();
  if (!mongodbUri && !mongodbDatabase) {
    return;
  }

  try {
    await connectMongo({ mongodbUri, mongodbDatabase });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("MongoDB connection failed:", errorName);
    throw error;
  }

  nitroApp.hooks.hook("close", closeMongo);
});
