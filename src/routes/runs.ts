import { Router } from "express";
import { z } from "zod";
import { resolveRequestUserId } from "../services/authService";
import { createRun, createRunSchema, getRunDetail, submitRunResult, submitRunSchema } from "../services/runService";

export const runsRouter = Router();

const createRunBodySchema = z.object({
  eventCode: z.string().min(1).optional(),
  event_code: z.string().min(1).optional()
});

runsRouter.post("/create", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    const body = createRunBodySchema.parse(req.body ?? {});
    const eventCode = body.eventCode ?? body.event_code;

    if (!eventCode) {
      return res.status(400).json({ ok: false, error: "Missing eventCode" });
    }

    const payload = createRunSchema.parse({ eventCode, userId });
    const result = await createRun(payload);
    return res.status(201).json({ ok: true, ...result });
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

runsRouter.get("/:runId", async (req, res, next) => {
  try {
    const schema = z.object({ runId: z.string().uuid() });
    const { runId } = schema.parse(req.params);
    const runDetail = await getRunDetail(runId);
    return res.status(200).json({ ok: true, ...runDetail });
  } catch (error) {
    return next(error);
  }
});
