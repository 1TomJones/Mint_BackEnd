import { Router } from "express";
import { createAdminEvent, createAdminEventSchema, listPublicEvents } from "../services/eventService";
import { resolveRequestUser } from "../services/authService";
import { requireAdmin } from "../services/adminService";

export const eventsRouter = Router();

eventsRouter.get("/public", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.post("/create", async (req, res, next) => {
  try {
    const user = await resolveRequestUser(req, { allowLegacyHeaderOnly: true });
    requireAdmin(user);
    const payload = createAdminEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    console.log("event_created", { route: req.originalUrl, event_code: event.event_code, scenario_id: event.scenario_id, duration_minutes: event.duration_minutes, status: event.status });
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});
