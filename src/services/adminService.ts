import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

export async function isAdmin(userId: string) {
  const { data: profile, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();

  if (error) {
    console.error("supabase_error", {
      route: "admin_check",
      code: error.code,
      message: error.message,
      details: error.details
    });
    throw new HttpError(500, "Failed to validate admin user");
  }

  return Boolean(profile?.is_admin);
}

export async function requireAdmin(userId: string | undefined) {
  if (!userId) {
    throw new HttpError(401, "Missing x-user-id header");
  }

  const admin = await isAdmin(userId);
  if (!admin) {
    throw new HttpError(403, "Admin access required");
  }

  return userId;
}
