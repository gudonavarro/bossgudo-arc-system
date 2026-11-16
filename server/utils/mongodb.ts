import { MongoClient, type Db } from "mongodb";

export interface MongoRuntimeConfig {
  mongodbUri?: string;
  mongodbDatabase?: string;
}

let client: MongoClient | undefined;
let connection: Promise<Db> | undefined;
let connectionUri: string | undefined;
let databaseName: string | undefined;

export async function connectMongo({
  mongodbUri,
  mongodbDatabase,
}: MongoRuntimeConfig): Promise<Db> {
  if (!mongodbUri || !mongodbDatabase) {
    throw new Error("MongoDB configuration is missing.");
  }

  if (connection !== undefined) {
    if (mongodbUri !== connectionUri || mongodbDatabase !== databaseName) {
      throw new Error("MongoDB configuration changed after connecting.");
    }
    return connection;
  }

  connectionUri = mongodbUri;
  databaseName = mongodbDatabase;
  const mongoClient = new MongoClient(mongodbUri);
  client = mongoClient;
  connection = (async () => {
    try {
      await mongoClient.connect();
      const db = mongoClient.db(mongodbDatabase);
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("users").createIndex({ phoneNumber: 1 }, { unique: true }),
        db.collection("users").createIndex(
          { resetTokenHash: 1 },
          { unique: true, sparse: true },
        ),
        db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
        db.collection("sessions").createIndex({ userId: 1 }),
        db.collection("sessions").createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0 },
        ),
      ]);
      return db;
    } catch (error) {
      await mongoClient.close();
      client = undefined;
      connection = undefined;
      connectionUri = undefined;
      databaseName = undefined;
      throw error;
    }
  })();

  return connection;
}

export async function getMongoDatabase(
  config: MongoRuntimeConfig,
): Promise<Db> {
  return connectMongo(config);
}

export async function getMongoClient(
  config: MongoRuntimeConfig,
): Promise<MongoClient> {
  await connectMongo(config);
  if (!client) {
    throw new Error("MongoDB client is unavailable after connecting.");
  }
  return client;
}

export async function pingMongo(config: MongoRuntimeConfig): Promise<void> {
  const db = await getMongoDatabase(config);
  await db.command({ ping: 1 });
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
  }
  client = undefined;
  connection = undefined;
  connectionUri = undefined;
  databaseName = undefined;
}
