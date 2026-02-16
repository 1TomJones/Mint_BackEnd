import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const requiredEventColumns = ["code", "name", "sim_url", "scenario_id", "duration_minutes", "status"] as const;
const selectedEventColumns = "id,event_code:code,event_name:name,sim_url,scenario_id,duration_minutes,status,starts_at,ends_at,created_at";

export const createAdminEventSchema = z.object({
  event_code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/),
  event_name: z.string().trim().min(1),
  sim_url: z.string().url(),
  scenario_id: z.string().trim().min(1),
  duration_minutes: z.coerce.number().int().positive()
});

function parseMissingColumnNames(error: { code?: string | null; message?: string | null; details?: string | null }) {
  const combinedText = `${error.message ?? ""} ${error.details ?? ""}`;
  const columnMatches = [...combinedText.matchAll(/column\s+"?([a-zA-Z0-9_]+)"?/gi)].map((match) => match[1]);

  const knownMissingColumns = requiredEventColumns.filter((column) => {
    if (columnMatches.includes(column)) {
      return true;
    }

    return combinedText.toLowerCase().includes(column);
  });

  return [...new Set(knownMissingColumns)];
}

function throwSchemaMismatchIfRequiredColumnsMissing(error: { code?: string | null; message?: string | null; details?: string | null }) {
  const missingColumns = parseMissingColumnNames(error);
  if (missingColumns.length > 0) {
    throw new HttpError(500, `Supabase schema mismatch: missing events column(s): ${missingColumns.join(", ")}`);
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
    .select(selectedEventColumns)
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
    .select(selectedEventColumns)
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
      code: payload.event_code,
      name: payload.event_name,
      sim_url: payload.sim_url,
      scenario_id: payload.scenario_id,
      duration_minutes: payload.duration_minutes,
      status: "active"
    })
    .select(selectedEventColumns)
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
    .eq("code", eventCode)
    .select("event_code:code,status,starts_at,ends_at")
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
  return "Supabase schema mismatch";
}
