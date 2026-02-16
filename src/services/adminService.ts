import { User } from "@supabase/supabase-js";
import { env } from "../config/env";
import { HttpError } from "../types/errors";

const adminEmailAllowlist = new Set(
  (env.ADMIN_ALLOWLIST_EMAILS ?? env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function requireAdmin(user: User | undefined) {
  if (!user) {
    throw new HttpError(401, "Missing user identity");
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(403, "Admin access required");
  }

  if (!adminEmailAllowlist.has(email)) {
    throw new HttpError(403, "Admin access required");
  }

  return user.id;
}
