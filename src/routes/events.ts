import { Router } from "express";
import { z } from "zod";
import { createAdminEvent, listPublicEvents } from "../services/eventService";
import { getBearerToken, resolveUserFromAccessToken } from "../services/authService";
import { env } from "../config/env";

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

const adminEmailAllowlist = new Set(
  (env.ADMIN_ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

eventsRouter.get("/public", async (_req, res, next) => {
  try {
    const result = await listPublicEvents();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

eventsRouter.post("/create", async (req, res) => {
  const requestId = req.requestId;
  const headerUserId = Array.isArray(req.headers["x-user-id"]) ? req.headers["x-user-id"][0] : req.headers["x-user-id"];

  let accessToken: string | undefined;
  try {
    accessToken = getBearerToken(req.headers.authorization);
  } catch (_error) {
    console.warn("event_create_auth", { request_id: requestId, decision: "forbidden", reason: "invalid_auth_header" });
    return res.status(401).json({ error: "unauthorized", detail: "invalid authorization header" });
  }

  if (!accessToken) {
    console.warn("event_create_auth", { request_id: requestId, decision: "forbidden", reason: "missing_auth_header" });
    return res.status(401).json({ error: "unauthorized", detail: "missing authorization header" });
  }

  let user;
  try {
    user = await resolveUserFromAccessToken(accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid access token";
    console.warn("event_create_auth", {
      request_id: requestId,
      decision: "forbidden",
      reason: "invalid_access_token",
      header_user_id: headerUserId,
      detail: message
    });
    return res.status(401).json({ error: "unauthorized", detail: message });
  }

  const email = user.email?.trim().toLowerCase();
  if (adminEmailAllowlist.size > 0 && (!email || !adminEmailAllowlist.has(email))) {
    console.warn("event_create_auth", {
      request_id: requestId,
      user_id: user.id,
      user_email: email,
      header_user_id: headerUserId,
      decision: "forbidden",
      reason: "email_not_in_allowlist"
    });
    return res.status(403).json({ error: "forbidden", detail: "email not in allowlist" });
  }

  try {
    const payload = createEventSchema.parse(req.body);
    const event = await createAdminEvent(payload);
    console.log("event_create_db", {
      request_id: requestId,
      user_id: user.id,
      user_email: email,
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
      user_id: user.id,
      user_email: email,
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
