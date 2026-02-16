import { Router } from "express";
import { z } from "zod";
import { getLeaderboard } from "../services/leaderboardService";
import { getEventByCode } from "../services/adminService";

const paramsSchema = z.object({
  code: z.string().min(1)
});

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional()
});

export const eventsRouter = Router();

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
