import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";
import { getSchemaMismatchMessage } from "./eventService";

export const createRunSchema = z.object({
  event_code: z.string().min(1),
  user_id: z.string().uuid()
});

export const submitRunSchema = z.object({
  runId: z.string().uuid(),
  score: z.number(),
  pnl: z.number().nullable().optional().default(null),
  sharpe: z.number().nullable().optional().default(null),
  dd: z.number().nullable().optional().default(null)
});

function logSupabaseError(route: string, error: { message?: string | null; code?: string | null; details?: string | null }) {
  console.error("supabase_error", {
    route,
    code: error.code,
    message: error.message,
    details: error.details
  });
}

function throwSchemaMismatchIfRequiredColumnsMissing(error: { code?: string | null; message?: string | null; details?: string | null }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "42703" || text.includes("scenario_id") || text.includes("duration_minutes")) {
    throw new HttpError(500, getSchemaMismatchMessage());
  }
}

export async function createRun(input: z.infer<typeof createRunSchema>) {
  const payload = createRunSchema.parse(input);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("event_code, event_name, sim_url, scenario_id, status")
    .eq("event_code", payload.event_code)
    .maybeSingle();

  if (eventError) {
    logSupabaseError("POST /api/runs/create event_lookup", eventError);
    throwSchemaMismatchIfRequiredColumnsMissing(eventError);
    throw new HttpError(500, `Failed to fetch event: ${eventError.message}`);
  }

  if (!event) {
    throw new HttpError(404, "Event code not found");
  }

  if (!event.scenario_id) {
    throw new HttpError(500, getSchemaMismatchMessage());
  }

  if (!["active", "running"].includes(event.status)) {
    throw new HttpError(409, `Event is not joinable (status: ${event.status})`);
  }

  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      event_code: payload.event_code,
      user_id: payload.user_id,
      status: "active"
    })
    .select("id")
    .single();

  if (runError || !run) {
    if (runError) {
      logSupabaseError("POST /api/runs/create run_insert", runError);
    }
    throw new HttpError(500, `Failed to create run: ${runError?.message ?? "unknown error"}`);
  }

  return {
    run_id: run.id,
    event: {
      event_code: event.event_code,
      event_name: event.event_name,
      status: event.status
    },
    sim_url: event.sim_url,
    scenario_id: event.scenario_id
  };
}

export async function submitRunResult(input: z.infer<typeof submitRunSchema>) {
  const { error } = await supabase.from("run_results").insert({
    run_id: input.runId,
    score: input.score,
    pnl: input.pnl,
    sharpe: input.sharpe,
    dd: input.dd
  });

  if (error) {
    logSupabaseError("POST /api/runs/submit", error);
    throw new HttpError(500, `Failed to save run result: ${error.message}`);
  }

  return { ok: true };
}

export async function getRunDetail(runId: string) {
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, event_code, user_id, created_at, status")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    throw new HttpError(500, `Failed to fetch run: ${runError.message}`);
  }

  if (!run) {
    throw new HttpError(404, "Run not found");
  }

  return { run };
}

export async function getRunsHistory(userId: string) {
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id,created_at,finished_at,event_id,events!runs_event_id_fkey(name,code),run_results(score,pnl,sharpe,max_drawdown)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("GET /api/runs/history", error);
    throw new HttpError(500, `Failed to fetch runs history: ${error.message}`);
  }

  return {
    runs: data ?? []
  };
}
