import crypto from "crypto";
import { z } from "zod";
import { env } from "../config/env";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const adminTokenPayloadSchema = z.object({
  eventCode: z.string().min(1),
  adminUserId: z.string().min(1),
  exp: z.number().int().positive()
});

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signAdminToken(payload: z.infer<typeof adminTokenPayloadSchema>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", env.ADMIN_JWT_SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function verifyAdminToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "Invalid admin token");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", env.ADMIN_JWT_SECRET).update(signingInput).digest("base64url");
  const actualSigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (actualSigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(actualSigBuffer, expectedSigBuffer)) {
    throw new HttpError(401, "Invalid admin token");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_error) {
    throw new HttpError(401, "Invalid admin token");
  }

  const parsed = adminTokenPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(401, "Invalid admin token");
  }

  if (parsed.data.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Admin token expired");
  }

  return parsed.data;
}

function getAdminEmailAllowlist() {
  return (env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && profile) {
    return Boolean(profile.is_admin);
  }

  if (profileError) {
    const tableMissing = /does not exist|relation .*profiles/i.test(profileError.message);
    if (!tableMissing) {
      console.error("Failed to validate admin from profiles", { userId, error: profileError.message });
      throw new HttpError(500, "Failed to validate admin user");
    }
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authUser.user) {
    console.error("Failed to validate admin from auth.users", { userId, error: authError?.message ?? "not found" });
    throw new HttpError(500, "Failed to validate admin user");
  }

  const email = authUser.user.email?.toLowerCase();
  if (!email) {
    return false;
  }

  return getAdminEmailAllowlist().includes(email);
}

export async function requireAdmin(userId: string | undefined) {
  if (!userId) {
    throw new HttpError(401, "Missing x-user-id");
  }

  const admin = await isAdmin(userId);
  if (!admin) {
    throw new HttpError(403, "Admin access required");
  }

  return userId;
}

export async function getEventByCode(code: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, code, sim_url, state, started_at, ended_at, duration_minutes, scenario_id")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to load event: ${error.message}`);
  }

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return event;
}

export async function createSimAdminLink(eventCode: string, adminUserId: string) {
  const event = await getEventByCode(eventCode);
  if (!["active", "live"].includes(event.state)) {
    throw new HttpError(409, `Admin link is only available while event is active/live (current: ${event.state})`);
  }
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = signAdminToken({ eventCode: event.code, adminUserId, exp });
  const baseAdminUrl = `${event.sim_url.replace(/\/$/, "")}/admin.html`;
  const separator = baseAdminUrl.includes("?") ? "&" : "?";

  return {
    adminUrl: `${baseAdminUrl}${separator}event_code=${encodeURIComponent(event.code)}&admin_token=${encodeURIComponent(token)}`
  };
}

export async function updateEventState(
  code: string,
  action: "start" | "pause" | "resume" | "end"
) {
  const event = await getEventByCode(code);
  const nowIso = new Date().toISOString();

  const patch: Record<string, string | null> = {};

  if (action === "start") {
    patch.state = "live";
    patch.started_at = nowIso;
  } else if (action === "pause") {
    patch.state = "paused";
  } else if (action === "resume") {
    patch.state = "live";
    if (!event.started_at) {
      patch.started_at = nowIso;
    }
  } else if (action === "end") {
    patch.state = "ended";
    patch.ended_at = nowIso;
  }

  const { error } = await supabase.from("events").update(patch).eq("id", event.id);
  if (error) {
    throw new HttpError(500, `Failed to update event state: ${error.message}`);
  }

  return { ok: true };
}

export function validateAdminToken(eventCode: string, token: string) {
  const payload = verifyAdminToken(token);
  if (payload.eventCode !== eventCode) {
    throw new HttpError(401, "Admin token does not match event code");
  }

  return {
    ok: true,
    eventCode: payload.eventCode,
    adminUserId: payload.adminUserId
  };
}
