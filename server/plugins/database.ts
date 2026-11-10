import mongoose from "mongoose";
import { defineNitroPlugin } from "nitropack/runtime";

const CONNECTED_STATE = 1;

export default defineNitroPlugin(async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoose.connection.readyState === CONNECTED_STATE) {
    return;
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("MongoDB connection failed:", errorName);
    throw error;
  }
});
