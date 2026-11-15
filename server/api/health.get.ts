import { pingMongo } from "../utils/mongodb";

export default defineEventHandler(async (event) => {
  try {
    await pingMongo(useRuntimeConfig(event));
    return { status: "ok" };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("MongoDB health check failed:", errorName);
    setResponseStatus(event, 503);
    return { status: "database_unavailable" };
  }
});
