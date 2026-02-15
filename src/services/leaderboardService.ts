import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const DEFAULT_LIMIT = 50;

export async function getLeaderboard(eventCode: string, limit: number = DEFAULT_LIMIT) {
  const safeLimit = Math.min(limit, DEFAULT_LIMIT);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, code")
    .eq("code", eventCode)
    .maybeSingle();

  if (eventError) {
    throw new HttpError(500, `Failed to fetch event: ${eventError.message}`);
  }

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  const { data: rows, error: rowsError } = await supabase
    .from("run_results")
    .select(
      "run_id, created_at, score, pnl, sharpe, max_drawdown, win_rate, run:run_id!inner(user_id, event_id)"
    )
    .eq("run.event_id", event.id)
    .order("score", { ascending: false })
    .order("pnl", { ascending: false })
    .limit(safeLimit);

  if (rowsError) {
    throw new HttpError(500, `Failed to fetch leaderboard: ${rowsError.message}`);
  }

  const userIds = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => {
          const run = (Array.isArray((row as any).run) ? (row as any).run[0] : (row as any).run) as { user_id?: string } | null;
          return run?.user_id;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const displayNameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (!profilesError) {
      for (const profile of profiles ?? []) {
        if (profile.id && profile.display_name) {
          displayNameByUserId.set(profile.id, profile.display_name);
        }
      }
    }
  }

  return {
    eventCode: event.code,
    leaderboard: (rows ?? []).map((row) => {
      const run = (Array.isArray((row as any).run) ? (row as any).run[0] : (row as any).run) as { user_id?: string } | null;
      const userId = run?.user_id ?? null;

      return {
        runId: row.run_id,
        userId,
        display_name: userId ? displayNameByUserId.get(userId) ?? null : null,
        created_at: row.created_at,
        score: row.score,
        pnl: row.pnl,
        sharpe: row.sharpe,
        max_drawdown: row.max_drawdown,
        win_rate: row.win_rate
      };
    })
  };
}
