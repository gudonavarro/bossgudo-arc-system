import { defineNitroPlugin } from "nitropack/runtime";
import { getUserModel } from "../models/user";
import { closeMongo } from "../utils/mongodb";
import { connectMongoose } from "../utils/mongoose";

export default defineNitroPlugin(async (nitroApp) => {
  const { mongodbUri, mongodbDatabase } = useRuntimeConfig();
  if (!mongodbUri) {
    return;
  }

  try {
    const connection = await connectMongoose({ mongodbUri, mongodbDatabase });
    getUserModel(connection);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("MongoDB connection failed:", errorName);
    throw error;
  }

  nitroApp.hooks.hook("close", closeMongo);
});
