import { Router } from "express";
import { z } from "zod";
import { getLeaderboard } from "../services/leaderboardService";

const paramsSchema = z.object({
  code: z.string().min(1)
});

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const eventsRouter = Router();

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
