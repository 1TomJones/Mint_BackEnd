import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const DEFAULT_LIMIT = 50;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "anonymous";

  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

async function resolveDisplayName(userId: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return "anonymous";
  }

  const metadataDisplayName = data.user.user_metadata?.display_name;
  if (typeof metadataDisplayName === "string" && metadataDisplayName.trim().length > 0) {
    return metadataDisplayName;
  }

  return data.user.email ? maskEmail(data.user.email) : "anonymous";
}

export async function getLeaderboard(eventCode: string, limit: number = DEFAULT_LIMIT) {
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
    .select("score, pnl, run:run_id!inner(user_id, event_id)")
    .eq("run.event_id", event.id)
    .order("score", { ascending: false })
    .order("pnl", { ascending: false })
    .limit(limit);

  if (rowsError) {
    throw new HttpError(500, `Failed to fetch leaderboard: ${rowsError.message}`);
  }

  const leaderboard = await Promise.all(
    (rows ?? []).map(async (row, index) => {
      const run = Array.isArray(row.run) ? row.run[0] : row.run;
      const displayName = run?.user_id ? await resolveDisplayName(run.user_id) : "anonymous";

      return {
        rank: index + 1,
        displayName,
        score: row.score,
        pnl: row.pnl
      };
    })
  );

  return {
    eventCode: event.code,
    leaderboard
  };
}
