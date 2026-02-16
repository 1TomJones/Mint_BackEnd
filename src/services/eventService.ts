import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const schemaMismatchMessage = "Supabase schema mismatch: events.scenario_id/duration_minutes required.";

export const createAdminEventSchema = z.object({
  event_code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/),
  event_name: z.string().trim().min(1),
  sim_url: z.string().url(),
  scenario_id: z.string().trim().min(1),
  duration_minutes: z.coerce.number().int().positive()
});

function throwSchemaMismatchIfRequiredColumnsMissing(error: { code?: string | null; message?: string | null; details?: string | null }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const isMissingScenario = error.code === "42703" || text.includes("scenario_id");
  const isMissingDuration = error.code === "42703" || text.includes("duration_minutes");

  if (isMissingScenario || isMissingDuration) {
    throw new HttpError(500, schemaMismatchMessage);
  }
}

function logSupabaseError(route: string, error: { message?: string | null; code?: string | null; details?: string | null }) {
  console.error("supabase_error", {
    route,
    code: error.code,
    message: error.message,
    details: error.details
  });
}

export async function listPublicEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("event_code, event_name, sim_url, scenario_id, duration_minutes, status, starts_at, ends_at, created_at")
    .in("status", ["active", "running"])
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("GET /api/events/public", error);
    throwSchemaMismatchIfRequiredColumnsMissing(error);
    throw new HttpError(500, `Failed to list public events: ${error.message}`);
  }

  return {
    events: data ?? []
  };
}

export async function listAdminEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("event_code, event_name, sim_url, scenario_id, duration_minutes, status, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("GET /api/admin/events", error);
    throwSchemaMismatchIfRequiredColumnsMissing(error);
    throw new HttpError(500, `Failed to list admin events: ${error.message}`);
  }

  return {
    events: data ?? []
  };
}

export async function createAdminEvent(input: z.infer<typeof createAdminEventSchema>) {
  const payload = createAdminEventSchema.parse(input);

  const { data, error } = await supabase
    .from("events")
    .insert({
      event_code: payload.event_code,
      event_name: payload.event_name,
      sim_url: payload.sim_url,
      scenario_id: payload.scenario_id,
      duration_minutes: payload.duration_minutes,
      status: "active"
    })
    .select("event_code, event_name, sim_url, scenario_id, duration_minutes, status, starts_at, ends_at, created_at")
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseError("POST /api/admin/events", error);
      throwSchemaMismatchIfRequiredColumnsMissing(error);
    }

    throw new HttpError(500, `Failed to create event: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

export async function updateEventStatus(eventCode: string, action: "start" | "pause" | "end") {
  const nowIso = new Date().toISOString();
  const patch: Record<string, string | null> = {};

  if (action === "start") {
    patch.status = "running";
    patch.starts_at = nowIso;
  } else if (action === "pause") {
    patch.status = "active";
  } else {
    patch.status = "ended";
    patch.ends_at = nowIso;
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("event_code", eventCode)
    .select("event_code, status, starts_at, ends_at")
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseError(`POST /api/admin/events/${eventCode}/${action}`, error);
      throwSchemaMismatchIfRequiredColumnsMissing(error);
      if (error.code === "PGRST116") {
        throw new HttpError(404, "Event not found");
      }
    }

    throw new HttpError(500, `Failed to update event status: ${error?.message ?? "unknown error"}`);
  }

  if (action === "end") {
    console.log("finalize_scores_hook", { event_code: eventCode, status: "queued_placeholder" });
  }

  return data;
}

export function getSchemaMismatchMessage() {
  return schemaMismatchMessage;
}
