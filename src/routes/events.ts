import { Router } from "express";
import { z } from "zod";
import { getLeaderboard } from "../services/leaderboardService";
import { getEventByCode, isAdmin, requireAdmin } from "../services/adminService";
import { createEvent, listEvents, listPublicEvents, parseEventState } from "../services/eventService";
import { resolveRequestUserId } from "../services/authService";
import { HttpError } from "../types/errors";

const paramsSchema = z.object({
  code: z.string().min(1)
});

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional()
});

const listEventsQuerySchema = z.object({
  state: z.string().optional()
});

const createEventSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/, "code must be uppercase"),
  name: z.string().trim().min(1),
  sim_type: z.literal("portfolio").optional().default("portfolio"),
  sim_url: z.string().url(),
  scenario_id: z.string().trim().min(1),
  scenario_name: z.string().trim().min(1).optional(),
  duration_minutes: z.coerce.number().int().min(1).max(180)
});

function validateCreateEventPayload(body: unknown) {
  const rawPayload = body as Record<string, unknown>;
  if (!rawPayload?.scenario_id) {
    throw new HttpError(400, "scenario_id is required");
  }

  if (rawPayload.duration_minutes === undefined || rawPayload.duration_minutes === null || rawPayload.duration_minutes === "") {
    throw new HttpError(400, "duration_minutes is required");
  }

  return createEventSchema.parse(body);
}

function toCreatedEventResponse(event: {
  id: string;
  code: string;
  name: string;
  scenario_id: string;
  duration_minutes: number;
  sim_url: string;
  state: string;
}) {
  return {
    id: event.id,
    code: event.code,
    name: event.name,
    scenario_id: event.scenario_id,
    duration_minutes: event.duration_minutes,
    sim_url: event.sim_url,
    status: event.state
  };
}

export const eventsRouter = Router();

eventsRouter.get("/public", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/public-active", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });

    const { state: rawState } = listEventsQuerySchema.parse(req.query);
    const state = rawState ? parseEventState(rawState) : undefined;
    const admin = await isAdmin(userId);

    if (state && !admin && !["active", "live", "paused"].includes(state)) {
      throw new HttpError(403, "Only admins can view this state");
    }

    const result = await listEvents({
      state,
      includeAll: admin
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.post("/", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const payload = validateCreateEventPayload(req.body);
    const event = await createEvent({ ...payload, admin_user_id: userId });
    return res.status(201).json({ ok: true, event: toCreatedEventResponse(event) });
  } catch (error) {
    return next(error);
  }
});

eventsRouter.post("/create", async (req, res, next) => {
  try {
    const userId = await resolveRequestUserId(req, { allowLegacyHeaderOnly: true });
    await requireAdmin(userId);
    const payload = validateCreateEventPayload(req.body);
    const event = await createEvent({ ...payload, admin_user_id: userId });
    return res.status(201).json({ ok: true, event: toCreatedEventResponse(event) });
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/:code/status", async (req, res, next) => {
  try {
    const { code } = paramsSchema.parse(req.params);
    const event = await getEventByCode(code);
    return res.status(200).json({
      state: event.state,
      started_at: event.started_at,
      ended_at: event.ended_at,
      duration_minutes: event.duration_minutes,
      scenario_id: event.scenario_id,
      sim_url: event.sim_url
    });
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/:code/leaderboard", async (req, res, next) => {
  try {
    const { code } = paramsSchema.parse(req.params);
    const { limit } = querySchema.parse(req.query);
    const result = await getLeaderboard(code, limit);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
