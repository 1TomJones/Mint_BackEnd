import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { createEvent } from "../services/eventService";
import { resolveRequestUserId } from "../services/authService";
import { createSimAdminLink, requireAdmin, updateEventState, validateAdminToken } from "../services/adminService";

export const adminRouter = Router();

const simAdminLinkSchema = z.object({
  eventCode: z.string().min(1)
});

const createEventSchema = z.object({
  event_code: z.string().min(1).regex(/^[A-Z0-9_-]+$/, "event_code must be uppercase"),
  event_name: z.string().min(1),
  scenario_id: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().optional(),
  sim_url: z.string().url().optional()
});

const codeParamSchema = z.object({
  code: z.string().min(1)
});

const tokenQuerySchema = z.object({
  event_code: z.string().min(1),
  admin_token: z.string().min(1)
});

adminRouter.post("/sim-admin-link", async (req, res, next) => {
  try {
    const adminUserId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(adminUserId);
    const { eventCode } = simAdminLinkSchema.parse(req.body);
    const result = await createSimAdminLink(eventCode, adminUserId);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/create", async (req, res, next) => {
  try {
    const adminUserId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(adminUserId);
    const payload = createEventSchema.parse(req.body);

    const event = await createEvent({
      code: payload.event_code,
      name: payload.event_name,
      sim_type: "portfolio",
      sim_url: payload.sim_url ?? env.PORTFOLIO_SIM_URL ?? env.SIM_SITE_URL,
      scenario_id: payload.scenario_id,
      duration_minutes: payload.duration_minutes
    });

    return res.status(201).json({ ok: true, event });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/start", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "start");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/pause", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "pause");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/resume", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "resume");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/end", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "end");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/validate-token", (req, res, next) => {
  try {
    const { event_code, admin_token } = tokenQuerySchema.parse(req.query);
    const result = validateAdminToken(event_code, admin_token);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
