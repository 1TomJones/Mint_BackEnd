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
  duration_minutes: z.number().int().positive().optional()
});

export type EventState = z.infer<typeof eventStateSchema>;
export type CreateEventInput = z.infer<typeof createEventInputSchema>;

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
    .select("id, code, name, sim_type, sim_url, scenario_id, duration_minutes, state, started_at, ended_at, created_at")
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
    .select("code, name, scenario_id, sim_type, duration_minutes, state, created_at")
    .in("state", ["active", "live", "paused"])
    .is("ended_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to list public events: ${error.message}`);
  }

  return {
    events: data ?? []
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
    .select("id, code, name, sim_type, sim_url, scenario_id, duration_minutes, state, started_at, ended_at, created_at")
    .single();

  if (createError || !createdEvent) {
    throw new HttpError(500, `Failed to create event: ${createError?.message ?? "unknown error"}`);
  }

  return createdEvent;
}
