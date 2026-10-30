require("dotenv").config();

const express = require("express");
const helmet = require("helmet");

const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

const server = app.listen(port, host, () => {
  console.log(`BOSSGUDO API listening at http://${host}:${port}`);
});

server.on("error", (error) => {
  console.error("BOSSGUDO API failed to start:", error.message);
  process.exitCode = 1;
});
