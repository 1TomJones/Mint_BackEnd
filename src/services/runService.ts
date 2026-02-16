import { z } from "zod";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

export const createRunSchema = z.object({
  eventCode: z.string().min(1),
  userId: z.string().min(1)
});

export const submitRunSchema = z.object({
  runId: z.string().uuid(),
  score: z.number(),
  pnl: z.number().nullable().optional().default(null),
  sharpe: z.number().nullable().optional().default(null),
  max_drawdown: z.number().nullable().optional().default(null),
  win_rate: z.number().nullable().optional().default(null),
  extra: z.record(z.unknown()).nullable().optional().default(null)
});

export async function createRun(input: z.infer<typeof createRunSchema>) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, code, sim_url")
    .eq("code", input.eventCode)
    .maybeSingle();

  if (eventError) {
    console.error("Failed to fetch event", {
      eventCode: input.eventCode,
      error: eventError.message
    });
    throw new HttpError(500, `Failed to fetch event: ${eventError.message}`);
  }

  if (!event) {
    throw new HttpError(404, "Event code not found");
  }

  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      event_id: event.id,
      user_id: input.userId
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error("Failed to create run", {
      eventId: event.id,
      userId: input.userId,
      error: runError?.message ?? "unknown error"
    });
    throw new HttpError(500, `Failed to create run: ${runError?.message ?? "unknown error"}`);
  }

  return {
    runId: run.id,
    simUrl: `${event.sim_url}${event.sim_url.includes("?") ? "&" : "?"}run_id=${run.id}`
  };
}

export async function submitRunResult(input: z.infer<typeof submitRunSchema>) {
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, finished_at, event_id")
    .eq("id", input.runId)
    .maybeSingle();

  if (runError) {
    console.error("Submit run attempt", { runId: input.runId, duplicate: false, status: 500, reason: runError.message });
    throw new HttpError(500, `Failed to load run: ${runError.message}`);
  }

  if (!run) {
    console.log("Submit run attempt", { runId: input.runId, duplicate: false, status: 404 });
    throw new HttpError(404, "Run not found");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, state")
    .eq("id", run.event_id)
    .maybeSingle();

  if (eventError) {
    console.error("Submit run attempt", { runId: input.runId, duplicate: false, status: 500, reason: eventError.message });
    throw new HttpError(500, `Failed to load event for run: ${eventError.message}`);
  }

  if (!event) {
    console.log("Submit run attempt", { runId: input.runId, duplicate: false, status: 404, reason: "event_not_found" });
    throw new HttpError(404, "Event not found for run");
  }

  if (!["live", "ended"].includes(event.state)) {
    console.log("Submit run attempt", { runId: input.runId, duplicate: false, status: 409, reason: `event_state_${event.state}` });
    throw new HttpError(409, `Run submissions are not accepted while event is ${event.state}`);
  }

  const { data: existingResult, error: existingError } = await supabase
    .from("run_results")
    .select("run_id")
    .eq("run_id", input.runId)
    .maybeSingle();

  if (existingError) {
    console.error("Submit run attempt", {
      runId: input.runId,
      duplicate: false,
      status: 500,
      reason: existingError.message
    });
    throw new HttpError(500, `Failed to verify existing results: ${existingError.message}`);
  }

  if (existingResult || run.finished_at) {
    console.log("Submit run attempt", { runId: input.runId, duplicate: true, status: 409 });
    throw new HttpError(409, "Already submitted");
  }

  const { error: insertError } = await supabase.from("run_results").insert({
    run_id: input.runId,
    score: input.score,
    pnl: input.pnl,
    sharpe: input.sharpe,
    max_drawdown: input.max_drawdown,
    win_rate: input.win_rate,
    extra: input.extra
  });

  if (insertError) {
    console.error("Submit run attempt", { runId: input.runId, duplicate: false, status: 500, reason: insertError.message });
    throw new HttpError(500, `Failed to save run result: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("runs")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", input.runId);

  if (updateError) {
    console.error("Submit run attempt", { runId: input.runId, duplicate: false, status: 500, reason: updateError.message });
    throw new HttpError(500, `Failed to mark run as finished: ${updateError.message}`);
  }

  console.log("Submit run attempt", { runId: input.runId, duplicate: false, status: 200 });
  return { ok: true };
}

export async function getRunDetail(runId: string) {
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, event_id, user_id, created_at, finished_at")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    throw new HttpError(500, `Failed to fetch run: ${runError.message}`);
  }

  if (!run) {
    throw new HttpError(404, "Run not found");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, code, sim_url")
    .eq("id", run.event_id)
    .maybeSingle();

  if (eventError) {
    throw new HttpError(500, `Failed to fetch event: ${eventError.message}`);
  }

  const { data: result, error: resultError } = await supabase
    .from("run_results")
    .select("run_id, created_at, score, pnl, sharpe, max_drawdown, win_rate, extra")
    .eq("run_id", run.id)
    .maybeSingle();

  if (resultError) {
    throw new HttpError(500, `Failed to fetch run result: ${resultError.message}`);
  }

  return {
    run,
    event,
    result: result ?? null
  };
}
