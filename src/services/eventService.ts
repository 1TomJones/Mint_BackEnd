import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const requiredEventColumns = ["code", "name", "sim_url", "scenario_id", "duration_minutes", "status"] as const;
const selectedEventColumns = "id,code,name,description,sim_url,scenario_id,duration_minutes,status,starts_at,ends_at,created_at";

export const createAdminEventSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sim_url: z.string().url().optional(),
  simUrl: z.string().url().optional(),
  scenario_id: z.string().trim().min(1).optional(),
  scenarioId: z.string().trim().min(1).optional(),
  duration_minutes: z.coerce.number().int().positive().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  status: z.string().trim().optional()
}).superRefine((input, ctx) => {
  if (!input.sim_url && !input.simUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "simUrl or sim_url is required", path: ["simUrl"] });
  }

  if (!input.scenario_id && !input.scenarioId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "scenarioId or scenario_id is required", path: ["scenarioId"] });
  }

  if (!input.duration_minutes && !input.durationMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "durationMinutes or duration_minutes is required", path: ["durationMinutes"] });
  }
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
    .in("status", ["active", "running", "live", "paused"])
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
      sim_url: payload.sim_url ?? payload.simUrl,
      scenario_id: payload.scenario_id ?? payload.scenarioId,
      duration_minutes: payload.duration_minutes ?? payload.durationMinutes,
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

export async function setEventState(eventCode: string, state: string) {
  const normalizedState = state.trim().toLowerCase();
  const { data, error } = await supabase.from("events").update({ status: normalizedState }).eq("code", eventCode).select("code,status,starts_at,ends_at").single();

  if (error || !data) {
    if (error) {
      logSupabaseError(`POST /api/admin/events/${eventCode}/state`, error);
      throwSchemaMismatchIfRequiredColumnsMissing(error);
      if (error.code === "PGRST116") {
        throw new HttpError(404, "Event not found");
      }
    }

    throw new HttpError(500, `Failed to update event state: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

export function getSchemaMismatchMessage() {
  return "Supabase schema mismatch";
}
