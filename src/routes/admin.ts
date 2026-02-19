import { Router } from "express";
import { z } from "zod";
import { getAdminStatusForUserEmail, requireAdmin } from "../services/adminService";
import { resolveRequestUser } from "../services/authService";
import { createAdminEvent, createAdminEventSchema, listAdminEvents, updateEventStatus } from "../services/eventService";

export const adminRouter = Router();

const eventCodeParamSchema = z.object({
  event_code: z.string().trim().min(1)
});

adminRouter.get("/me", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req);
    const result = await getAdminStatusForUserEmail(user.email);

    console.log("admin_me_check", {
      route: req.originalUrl,
      method: req.method,
      email: user.email,
      is_admin: result.isAdmin
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/events", requireAdmin, async (req, res, next) => {
  try {
    const result = await listAdminEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events", requireAdmin, async (req, res, next) => {
  try {
    const payload = createAdminEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    console.log("event_created", { route: req.originalUrl, event_code: event.code, scenario_id: event.scenario_id, duration_minutes: event.duration_minutes, status: event.status });
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/start", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "start");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/pause", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "pause");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:event_code/end", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const event = await updateEventStatus(event_code, "end");
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});
