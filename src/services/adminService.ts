import { env } from "../config/env";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

const adminEmailAllowlist = new Set(
  (env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

async function isAllowlistedAdminEmail(userId: string) {
  if (adminEmailAllowlist.size === 0) {
    return false;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error("supabase_error", {
      route: "admin_check_allowlist",
      code: error.code,
      message: error.message
    });
    return false;
  }

  const email = data.user?.email?.toLowerCase();
  if (!email) {
    return false;
  }

  return adminEmailAllowlist.has(email);
}

export async function isAdmin(userId: string) {
  const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();

  if (error) {
    console.error("supabase_error", {
      route: "admin_check",
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  if (profile?.is_admin) {
    return true;
  }

  return isAllowlistedAdminEmail(userId);
}

export async function requireAdmin(userId: string | undefined) {
  if (!userId) {
    throw new HttpError(401, "Missing user identity");
  }

  const admin = await isAdmin(userId);
  if (!admin) {
    throw new HttpError(403, "Admin access required");
  }

  return userId;
}
