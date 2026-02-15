import { Router } from "express";
import { createRun, createRunSchema, submitRunResult, submitRunSchema } from "../services/runService";

export const runsRouter = Router();

runsRouter.post("/create", async (req, res, next) => {
  try {
    const payload = createRunSchema.parse(req.body);
    const result = await createRun(payload);
    return res.status(201).json(result);
  } catch (error) {
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
