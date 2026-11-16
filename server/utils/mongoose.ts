import mongoose, { type Connection } from "mongoose";
import { getMongoClient, type MongoRuntimeConfig } from "./mongodb";

export async function connectMongoose(
  config: MongoRuntimeConfig,
): Promise<Connection> {
  const { mongodbDatabase } = config;
  if (!mongodbDatabase) {
    throw new Error("MongoDB configuration is missing.");
  }

  const client = await getMongoClient(config);
  const connection = mongoose.connection;

  if (connection.readyState === 0) {
    connection.setClient(client);
  } else if (connection.getClient() !== client) {
    throw new Error("Mongoose is already connected to a different MongoDB client.");
  }

  return connection.useDb(mongodbDatabase, { useCache: true });
}
