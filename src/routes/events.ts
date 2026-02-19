import { Router } from "express";
import { z } from "zod";
import { createAdminEvent, getJoinableEventByCode, listAdminEvents, listPublicEvents, updateEventStatusById } from "../services/eventService";
import { requireAdmin } from "../services/adminService";

export const eventsRouter = Router();

const createEventSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sim_url: z.string().url(),
  scenario_id: z.string().trim().min(1),
  duration_minutes: z.coerce.number().int().positive(),
  status: z.string().trim().optional()
});

const eventStatusBodySchema = z.object({
  status: z.enum(["draft", "active", "ended"])
});

const eventIdParamSchema = z.object({
  id: z.string().uuid()
});

const eventCodeParamSchema = z.object({
  code: z.string().trim().min(1)
});

eventsRouter.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const result = await listAdminEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/public", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.post("/create", requireAdmin, async (req, res) => {
  const requestId = req.requestId;
  const headerUserId = Array.isArray(req.headers["x-user-id"]) ? req.headers["x-user-id"][0] : req.headers["x-user-id"];

  try {
    const payload = createEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    console.log("event_create_db", {
      request_id: requestId,
      user_id: req.adminUserId,
      user_email: req.adminUserEmail,
      header_user_id: headerUserId,
      decision: "allowed",
      insert_result: "success",
      event_id: event.id,
      event_code: event.code
    });
    return res.status(201).json({ event });
  } catch (error) {
    console.error("event_create_db", {
      request_id: requestId,
      user_id: req.adminUserId,
      user_email: req.adminUserEmail,
      header_user_id: headerUserId,
      decision: "allowed",
      insert_result: "error",
      error: error instanceof Error ? error.message : "unknown error"
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "validation_failed", detail: error.flatten() });
    }

    return res.status(500).json({ error: "event_create_failed", detail: error instanceof Error ? error.message : "unknown error" });
  }
});

eventsRouter.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { id } = eventIdParamSchema.parse(req.params);
    const { status } = eventStatusBodySchema.parse(req.body);
    const event = await updateEventStatusById(id, status);
    return res.status(200).json({ event });
  } catch (error) {
    return next(error);
  }
});

eventsRouter.get("/by-code/:code", async (req, res, next) => {
  try {
    const { code } = eventCodeParamSchema.parse(req.params);
    const event = await getJoinableEventByCode(code.toUpperCase());
    return res.status(200).json({ event });
  } catch (error) {
    return next(error);
  }
});
