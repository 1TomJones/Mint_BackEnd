import { Router } from "express";
import { z } from "zod";
import { getLeaderboard } from "../services/leaderboardService";
import { getEventByCode, isAdmin, requireAdmin } from "../services/adminService";
import { createEvent, listEvents, listPublicEvents, parseEventState } from "../services/eventService";
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
  code: z.string().min(1).regex(/^[A-Z0-9_-]+$/, "code must be uppercase"),
  name: z.string().min(1),
  sim_type: z.literal("portfolio"),
  sim_url: z.string().url(),
  scenario_id: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().optional()
});

export const eventsRouter = Router();

eventsRouter.get("/public", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) {
      throw new HttpError(401, "Missing x-user-id header", {
        errorCode: "MISSING_USER_ID"
      });
    }

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
    await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const payload = createEventSchema.parse(req.body);
    const event = await createEvent(payload);
    return res.status(201).json({ event });
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
