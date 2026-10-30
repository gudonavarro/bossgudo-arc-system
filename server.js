require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { createAuthRouter } = require("./routes/auth");

const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use("/api/auth", createAuthRouter());

app.get("/health", (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  response
    .status(databaseConnected ? 200 : 503)
    .json({ status: databaseConnected ? "ok" : "database_unavailable" });
});

if (require.main === module) {
  const server = app.listen(port, host, () => {
    console.log(`BOSSGUDO API listening at http://${host}:${port}`);
  });

  server.on("error", (error) => {
    console.error("BOSSGUDO API failed to start:", error.message);
    process.exitCode = 1;
  });

  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI).catch((error) => {
      console.error("MongoDB connection failed:", error.name);
      server.close(() => {
        process.exitCode = 1;
      });
    });
  }
}

module.exports = app;
