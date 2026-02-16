import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { eventsRouter } from "./routes/events";
import { runsRouter } from "./routes/runs";
import { adminRouter } from "./routes/admin";

const app = express();

app.use((req, res, next) => {
  const startedAt = Date.now();

  const allowedHeaders = "Content-Type, Authorization, x-user-id";
  const requestOrigin = req.headers.origin?.replace(/\/$/, "");
  const normalizedOrigin = requestOrigin?.toLowerCase();
  const isLocalDev = normalizedOrigin ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) : false;
  const isMintRender = normalizedOrigin ? /^https:\/\/mint-[a-z0-9-]+\.onrender\.com$/i.test(normalizedOrigin) : false;

  if (requestOrigin && (isLocalDev || isMintRender)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", allowedHeaders);

  res.on("finish", () => {
    console.log("request_log", {
      route: req.originalUrl,
      method: req.method,
      status_code: res.statusCode,
      user_id_present: Boolean(req.headers["x-user-id"]),
      duration_ms: Date.now() - startedAt
    });
  });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const apiRouter = express.Router();
apiRouter.use("/events", eventsRouter);
apiRouter.use("/runs", runsRouter);
apiRouter.use("/admin", adminRouter);
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Mint backend listening on port ${env.PORT}`);
});
