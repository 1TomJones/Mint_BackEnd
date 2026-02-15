import { Router } from "express";
import { ZodError, z } from "zod";
import { createRun, createRunSchema, getRunDetail, submitRunResult, submitRunSchema } from "../services/runService";
import { HttpError } from "../types/errors";

export const runsRouter = Router();

runsRouter.post("/create", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    const eventCode = req.body?.eventCode as string | undefined;

    if (!userId) {
      res.type("application/json");
      return res.status(401).json({ error: "Missing x-user-id" });
    }

    if (!eventCode) {
      res.type("application/json");
      return res.status(400).json({ error: "Missing eventCode" });
    }

    const payload = createRunSchema.parse({ eventCode, userId });
    const result = await createRun(payload);
    res.type("application/json");
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      res.type("application/json");
      return res.status(400).json({ error: "Event code not found" });
    }

    if (error instanceof HttpError && error.statusCode === 404) {
      res.type("application/json");
      return res.status(404).json({ error: "Event code not found" });
    }

    console.error("Failed to create run endpoint", {
      body: req.body,
      error
    });
    return next(error);
  }
});

runsRouter.post("/submit", async (req, res, next) => {
  try {
    const payload = submitRunSchema.parse(req.body);
    const result = await submitRunResult(payload);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

runsRouter.get("/:runId", async (req, res, next) => {
  try {
    const schema = z.object({ runId: z.string().uuid() });
    const { runId } = schema.parse(req.params);
    const runDetail = await getRunDetail(runId);
    return res.status(200).json(runDetail);
  } catch (error) {
    return next(error);
  }
});
