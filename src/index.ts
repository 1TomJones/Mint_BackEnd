import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { eventsRouter } from "./routes/events";
import { runsRouter } from "./routes/runs";
import { adminRouter } from "./routes/admin";

const app = express();

const corsOrigin = "https://mint-ez9f.onrender.com";
const corsAllowedMethods = "GET, POST, OPTIONS";
const corsAllowedHeaders = "Authorization, Content-Type, x-user-id";

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", corsAllowedHeaders);
  res.setHeader("Access-Control-Allow-Methods", corsAllowedMethods);
  res.setHeader("Vary", "Origin");

  res.on("finish", () => {
    console.log("request_log", {
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

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Mint backend listening on port ${env.PORT}`);
});
