import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../services/adminService";
import { resolveRequestUserId } from "../services/authService";
import { createAdminEvent, createAdminEventSchema, listAdminEvents, updateEventStatus } from "../services/eventService";

export const adminRouter = Router();

const eventCodeParamSchema = z.object({
  event_code: z.string().trim().min(1)
});

adminRouter.get("/events", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const result = await listAdminEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const payload = createAdminEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    return res.status(201).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/start", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "start");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/pause", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "pause");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/end", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "end");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});
