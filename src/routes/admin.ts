import { Router } from "express";
import { z } from "zod";
import { getAdminStatusForUserEmail, requireAdmin } from "../services/adminService";
import { resolveRequestUser } from "../services/authService";
import { createAdminEvent, createAdminEventSchema, listAdminEvents, setEventState, updateEventStatus } from "../services/eventService";
import { env } from "../config/env";

export const adminRouter = Router();

const eventCodeParamSchema = z
  .object({
    event_code: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional()
  })
  .transform((params) => ({ event_code: params.event_code ?? params.code ?? "" }));

const stateUpdateSchema = z.object({
  state: z.string().trim().min(1)
});

const simAdminLinkPostSchema = z
  .object({
    eventCode: z.string().trim().min(1).optional(),
    event_code: z.string().trim().min(1).optional()
  })
  .transform((body) => ({ eventCode: body.eventCode ?? body.event_code ?? "" }));

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

adminRouter.post("/events/:event_code/state", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const { state } = stateUpdateSchema.parse(req.body ?? {});
    const event = await setEventState(event_code, state);
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/state", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const { state } = stateUpdateSchema.parse(req.body ?? {});
    const event = await setEventState(event_code, state);
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/events/:event_code/sim-admin-link", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const adminUrl = `${env.SIM_SITE_URL.replace(/\/$/, "")}/admin?event_code=${encodeURIComponent(event_code)}&admin_token=${encodeURIComponent(env.SIM_ADMIN_TOKEN)}`;
    return res.status(200).json({ adminUrl });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/events/:code/sim-admin-link", requireAdmin, async (req, res, next) => {
  try {
    const { event_code } = eventCodeParamSchema.parse(req.params);
    const adminUrl = `${env.SIM_SITE_URL.replace(/\/$/, "")}/admin?event_code=${encodeURIComponent(event_code)}&admin_token=${encodeURIComponent(env.SIM_ADMIN_TOKEN)}`;
    return res.status(200).json({ adminUrl });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/sim-admin-link", requireAdmin, async (req, res, next) => {
  try {
    const { eventCode } = simAdminLinkPostSchema.parse(req.body ?? {});
    const adminUrl = `${env.SIM_SITE_URL.replace(/\/$/, "")}/admin?event_code=${encodeURIComponent(eventCode)}&admin_token=${encodeURIComponent(env.SIM_ADMIN_TOKEN)}`;
    return res.status(200).json({ adminUrl });
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
