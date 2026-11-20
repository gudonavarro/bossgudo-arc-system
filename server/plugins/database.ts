import { defineNitroPlugin } from "nitropack/runtime";
import { getUserModel } from "../models/user";
import { getAvailableDateModel } from "../models/available-date";
import { getPaymentModel } from "../models/payment";
import { getServiceBookingModel } from "../models/service-booking";
import {
  getServicePackageModel,
  removeLegacyPackageNameUniqueness,
} from "../models/service-package";
import { getVisitationBookingModel } from "../models/visitation-booking";
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
    // Registering the models builds their collections' indexes at startup.
    getServiceBookingModel(connection);
    getPaymentModel(connection);
    getVisitationBookingModel(connection);
    getAvailableDateModel(connection);
    await removeLegacyPackageNameUniqueness(getServicePackageModel(connection));
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("MongoDB connection failed:", errorName);
  }

  nitroApp.hooks.hook("close", closeMongo);
});
