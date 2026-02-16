import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const eventStateSchema = z.enum(["draft", "active", "live", "paused", "ended"]);

const createEventInputSchema = z.object({
  code: z.string().min(1).regex(/^[A-Z0-9_-]+$/, "code must be uppercase"),
  name: z.string().min(1),
  sim_type: z.literal("portfolio"),
  sim_url: z.string().url(),
  scenario_id: z.string().min(1),
  scenario_name: z.string().min(1).optional(),
  duration_minutes: z.number().int().min(1).max(180),
  admin_user_id: z.string().min(1)
});

export type EventState = z.infer<typeof eventStateSchema>;
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

function isMissingColumnError(error: { message?: string | null; details?: string | null; code?: string | null }, columnName: string) {
  const content = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42703" || content.includes(`column ${columnName.toLowerCase()}`) || content.includes(`events.${columnName.toLowerCase()}`);
}

function throwSchemaMismatchIfScenarioIdMissing(error: { message?: string | null; details?: string | null; code?: string | null }) {
  const content = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const missingColumnCode = error.code === "42703";
  const missingScenarioIdText =
    content.includes("events.scenario_id") ||
    content.includes("column scenario_id") ||
    content.includes("scenario_id does not exist");

  if (missingColumnCode || missingScenarioIdText) {
    throw new HttpError(500, "events.scenario_id missing", {
      errorCode: "SCHEMA_MISMATCH"
    });
  }
}

function throwSchemaMismatchIfRequiredColumnsMissing(error: { message?: string | null; details?: string | null; code?: string | null }) {
  throwSchemaMismatchIfScenarioIdMissing(error);

  const content = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const missingDurationText =
    error.code === "42703" ||
    content.includes("events.duration_minutes") ||
    content.includes("column duration_minutes") ||
    content.includes("duration_minutes does not exist");

  if (missingDurationText) {
    throw new HttpError(500, "events.duration_minutes missing", {
      errorCode: "SCHEMA_MISMATCH"
    });
  }
}

export function parseEventState(input: unknown) {
  const parsed = eventStateSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid event state filter");
  }

  return parsed.data;
}

export async function listEvents(options: { state?: EventState; includeAll: boolean }) {
  let query = supabase
    .from("events")
    .select("id, code, name, sim_type, sim_url, scenario_id, scenario_name, duration_minutes, state, started_at, ended_at, created_at")
    .order("created_at", { ascending: false });

  if (options.state) {
    query = query.eq("state", options.state);
  } else if (!options.includeAll) {
    query = query.in("state", ["active", "live", "paused"]).is("ended_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(500, `Failed to list events: ${error.message}`);
  }

  return {
    events: data ?? []
  };
}

export async function listPublicEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, code, name, scenario_id, duration_minutes, sim_url, state, started_at")
    .in("state", ["active", "live", "paused"])
    .is("ended_at", null)
    .order("started_at", { ascending: false, nullsFirst: false });

  if (error) {
    throwSchemaMismatchIfRequiredColumnsMissing(error);
    throw new HttpError(500, `Failed to list public events: ${error.message}`);
  }

  return {
    events: (data ?? []).map((event) => ({
      id: event.id,
      code: event.code,
      name: event.name,
      scenario_id: event.scenario_id,
      duration_minutes: event.duration_minutes,
      sim_url: event.sim_url,
      status: event.state,
      starts_at: event.started_at
    }))
  };
}

export async function createEvent(input: CreateEventInput) {
  const payload = createEventInputSchema.parse(input);

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("events")
    .select("id")
    .eq("code", payload.code)
    .maybeSingle();

  if (existingEventError) {
    throw new HttpError(500, `Failed to validate event code uniqueness: ${existingEventError.message}`);
  }

  if (existingEvent) {
    throw new HttpError(409, "Event code already exists");
  }

  const baseInsertPayload = {
    code: payload.code,
    name: payload.name,
    sim_type: payload.sim_type,
    sim_url: payload.sim_url,
    scenario_id: payload.scenario_id,
    scenario_name: payload.scenario_name,
    duration_minutes: payload.duration_minutes,
    state: "active" as const
  };

  const tryCreate = async (userColumn: "admin_user_id" | "created_by") =>
    supabase
      .from("events")
      .insert({
        ...baseInsertPayload,
        [userColumn]: payload.admin_user_id
      })
      .select("id, code, name, sim_type, sim_url, scenario_id, scenario_name, duration_minutes, state, started_at, ended_at, created_at")
      .single();

  let { data: createdEvent, error: createError } = await tryCreate("admin_user_id");

  if (createError && isMissingColumnError(createError, "admin_user_id")) {
    ({ data: createdEvent, error: createError } = await tryCreate("created_by"));
  }

  if (createError || !createdEvent) {
    if (createError) {
      throwSchemaMismatchIfRequiredColumnsMissing(createError);

      if (isMissingColumnError(createError, "created_by") || isMissingColumnError(createError, "admin_user_id")) {
        throw new HttpError(500, "events.created_by/admin_user_id missing", {
          errorCode: "SCHEMA_MISMATCH"
        });
      }
    }

    throw new HttpError(500, `Failed to create event: ${createError?.message ?? "unknown error"}`);
  }

  return createdEvent;
}
