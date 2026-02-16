import { env } from "../config/env";
import type { AuthenticatedUser } from "./authService";
import { HttpError } from "../types/errors";

const adminEmailAllowlist = new Set(
  (env.ADMIN_ALLOWLIST_EMAILS ?? env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function requireAdmin(user: AuthenticatedUser | undefined) {
  if (!user) {
    console.warn("admin_auth_rejected", {
      reason: "missing_user_identity"
    });
    throw new HttpError(401, "unauthorized");
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    console.warn("admin_auth_rejected", {
      reason: "missing_user_email",
      user_id: user.id
    });
    throw new HttpError(403, "forbidden");
  }

  if (!adminEmailAllowlist.has(email)) {
    console.warn("admin_auth_rejected", {
      reason: "email_not_allowlisted",
      user_id: user.id,
      email
    });
    throw new HttpError(403, "forbidden");
  }

  return user.id;
}
