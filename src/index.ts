import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { eventsRouter } from "./routes/events";
import { runsRouter } from "./routes/runs";

const app = express();

app.use((req, res, next) => {
  const allowedHeaders = "Content-Type, Authorization, x-user-id";
  const requestOrigin = req.headers.origin?.replace(/\/$/, "");
  const allowedOrigins = [env.MINT_SITE_URL, env.SIM_SITE_URL].map((origin) => origin.replace(/\/$/, ""));

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", allowedHeaders);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/runs", runsRouter);
app.use("/api/events", eventsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Mint backend listening on port ${env.PORT}`);
});
