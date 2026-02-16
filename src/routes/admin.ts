import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../services/adminService";
import { resolveRequestUser } from "../services/authService";
import { createAdminEvent, createAdminEventSchema, listAdminEvents, updateEventStatus } from "../services/eventService";

export const adminRouter = Router();

const eventCodeParamSchema = z.object({
  event_code: z.string().trim().min(1)
});

adminRouter.get("/events", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    requireAdmin(user);
    const result = await listAdminEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    requireAdmin(user);
    const payload = createAdminEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    console.log("event_created", { route: req.originalUrl, event_code: event.event_code, scenario_id: event.scenario_id, duration_minutes: event.duration_minutes, status: event.status });
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/start", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    requireAdmin(user);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "start");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/pause", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    requireAdmin(user);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "pause");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/end", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    requireAdmin(user);
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "end");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});
