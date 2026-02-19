import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const requiredEventColumns = ["code", "name", "sim_url", "scenario_id", "duration_minutes", "status"] as const;
const selectedEventColumns = "id,code,name,description,sim_url,scenario_id,duration_minutes,status,starts_at,ends_at,created_at";

export const createAdminEventSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sim_url: z.string().url(),
  scenario_id: z.string().trim().min(1),
  duration_minutes: z.coerce.number().int().positive(),
  status: z.string().trim().optional()
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
    .eq("status", "active")
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

export async function getJoinableEventByCode(eventCode: string) {
  const { data, error } = await supabase
    .from("events")
    .select(selectedEventColumns)
    .eq("code", eventCode)
    .maybeSingle();

  if (error) {
    logSupabaseError("GET /api/events/by-code/:code", error);
    throwSchemaMismatchIfRequiredColumnsMissing(error);
    throw new HttpError(500, `Failed to look up event by code: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "Event code not found");
  }

  if (data.status !== "active") {
    throw new HttpError(403, `Event is not joinable (status: ${data.status})`);
  }

  return data;
}

export async function listAdminEvents() {
  const { data, error } = await supabase.from("events").select(selectedEventColumns).order("created_at", { ascending: false });

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
      code: payload.code,
      name: payload.name,
      description: payload.description,
      sim_url: payload.sim_url,
      scenario_id: payload.scenario_id,
      duration_minutes: payload.duration_minutes,
      status: payload.status ?? "draft"
    })
    .select(selectedEventColumns)
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseError("POST /api/events/create", error);
      throwSchemaMismatchIfRequiredColumnsMissing(error);
    }

    throw new HttpError(500, `Failed to create event: ${error?.message ?? "unknown error"}`);
  }

  console.log("event_created", { event_id: data.id, event_code: data.code, status: data.status });

  return data;
}

const updateEventStatusSchema = z.enum(["draft", "active", "ended"]);

export async function updateEventStatusById(eventId: string, nextStatus: string) {
  const status = updateEventStatusSchema.parse(nextStatus);

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select(selectedEventColumns)
    .eq("id", eventId)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("PATCH /api/events/:id/status existing_lookup", existingError);
    throwSchemaMismatchIfRequiredColumnsMissing(existingError);
    throw new HttpError(500, `Failed to load event: ${existingError.message}`);
  }

  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  const patch: Record<string, string> = { status };
  const nowIso = new Date().toISOString();

  if (status === "active" && !existing.starts_at) {
    patch.starts_at = nowIso;
  }

  if (status === "ended" && !existing.ends_at) {
    patch.ends_at = nowIso;
  }

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select(selectedEventColumns)
    .single();

  if (updateError || !updated) {
    if (updateError) {
      logSupabaseError("PATCH /api/events/:id/status update", updateError);
      throwSchemaMismatchIfRequiredColumnsMissing(updateError);
    }

    throw new HttpError(500, `Failed to update event status: ${updateError?.message ?? "unknown error"}`);
  }

  console.log("event_status_changed", {
    event_id: updated.id,
    event_code: updated.code,
    old_status: existing.status,
    new_status: updated.status
  });

  return updated;
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

  const { data, error } = await supabase.from("events").update(patch).eq("code", eventCode).select("code,status,starts_at,ends_at").single();

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
