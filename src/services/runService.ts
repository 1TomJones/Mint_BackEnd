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
  pnl: z.number(),
  sharpe: z.number(),
  max_drawdown: z.number(),
  win_rate: z.number(),
  extra: z.record(z.unknown()).default({})
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
    .select("id, finished_at")
    .eq("id", input.runId)
    .maybeSingle();

  if (runError) {
    console.error("Failed to load run", { runId: input.runId, error: runError.message });
    throw new HttpError(500, `Failed to load run: ${runError.message}`);
  }

  if (!run) {
    throw new HttpError(404, "Run not found");
  }

  const { data: existingResult, error: existingError } = await supabase
    .from("run_results")
    .select("run_id")
    .eq("run_id", input.runId)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to verify existing results", {
      runId: input.runId,
      error: existingError.message
    });
    throw new HttpError(500, `Failed to verify existing results: ${existingError.message}`);
  }

  if (existingResult || run.finished_at) {
    throw new HttpError(409, "Run results already submitted");
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
    console.error("Failed to save run result", { runId: input.runId, error: insertError.message });
    throw new HttpError(500, `Failed to save run result: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("runs")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", input.runId);

  if (updateError) {
    console.error("Failed to mark run as finished", { runId: input.runId, error: updateError.message });
    throw new HttpError(500, `Failed to mark run as finished: ${updateError.message}`);
  }

  return { success: true };
}
