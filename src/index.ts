import crypto from "node:crypto";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { eventsRouter } from "./routes/events";
import { runsRouter } from "./routes/runs";
import { adminRouter } from "./routes/admin";

const app = express();

const corsAllowedOrigins = new Set([env.MINT_SITE_URL, env.SIM_SITE_URL]);
const corsAllowedMethods = "GET, POST, OPTIONS";
const corsAllowedHeaders = "Authorization, Content-Type, x-user-id";
const appVersion = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? process.env.npm_package_version ?? "unknown";

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  const requestOrigin = req.headers.origin;

  if (requestOrigin && corsAllowedOrigins.has(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  res.setHeader("Access-Control-Allow-Headers", corsAllowedHeaders);
  res.setHeader("Access-Control-Allow-Methods", corsAllowedMethods);
  res.setHeader("Vary", "Origin");
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    console.log("request_log", {
      request_id: requestId,
      route: req.originalUrl,
      method: req.method,
      status_code: res.statusCode,
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
app.use("/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log("backend_startup", {
    port: env.PORT,
    version: appVersion,
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    routes: ["GET /health", "GET /api/admin/me", "GET /admin/me"]
  });
  console.log("route_mounted", { route: "/api/admin/me" });
});
