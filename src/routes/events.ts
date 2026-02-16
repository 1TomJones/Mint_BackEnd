import { Router } from "express";
import { createAdminEvent, createAdminEventSchema, listPublicEvents } from "../services/eventService";
import { resolveRequestUserId } from "../services/authService";
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
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const payload = createAdminEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    return res.status(201).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});
