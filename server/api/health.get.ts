import mongoose from "mongoose";

export default defineEventHandler((event) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  setResponseStatus(event, databaseConnected ? 200 : 503);
  return {
    status: databaseConnected ? "ok" : "database_unavailable",
  };
});
