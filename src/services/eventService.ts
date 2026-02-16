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
  duration_minutes: z.number().int().positive().optional()
});

export type EventState = z.infer<typeof eventStateSchema>;
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

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
    .select("code, name, scenario_id, scenario_name, sim_type, duration_minutes, state, created_at")
    .in("state", ["active", "live", "paused"])
    .is("ended_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throwSchemaMismatchIfScenarioIdMissing(error);
    throw new HttpError(500, `Failed to list public events: ${error.message}`);
  }

  return {
    events: (data ?? []).map((event) => ({
      ...event,
      scenario_id: event.scenario_id ?? "unknown"
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

  const { data: createdEvent, error: createError } = await supabase
    .from("events")
    .insert({
      ...payload,
      state: "active"
    })
    .select("id, code, name, sim_type, sim_url, scenario_id, scenario_name, duration_minutes, state, started_at, ended_at, created_at")
    .single();

  if (createError || !createdEvent) {
    if (createError) {
      throwSchemaMismatchIfScenarioIdMissing(createError);
    }

    throw new HttpError(500, `Failed to create event: ${createError?.message ?? "unknown error"}`);
  }

  return createdEvent;
}
