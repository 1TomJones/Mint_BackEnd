import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { HttpError } from "../types/errors";

const adminEmailAllowlist = new Set(
  (env.ADMIN_ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const supabaseServerAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function getBearerToken(authHeader: string | undefined) {
  if (!authHeader) {
    return undefined;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "unauthorized");
  }

  return token;
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  let token: string | undefined;
  try {
    token = getBearerToken(req.headers.authorization);
  } catch (_error) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "invalid_auth_header"
    });
    return next(new HttpError(401, "unauthorized"));
  }

  if (!token) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "missing_user_identity"
    });
    return next(new HttpError(401, "unauthorized"));
  }

  const { data, error } = await supabaseServerAuthClient.auth.getUser(token);
  if (error || !data.user?.id) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "invalid_access_token",
      error_message: error?.message
    });
    return next(new HttpError(401, "unauthorized"));
  }

  const email = data.user.email?.trim().toLowerCase();
  if (!email) {
    console.warn("admin_auth_rejected", {
      reason: "missing_user_email",
      user_id: data.user.id
    });
    return next(new HttpError(403, "forbidden"));
  }

  if (!adminEmailAllowlist.has(email)) {
    console.warn("admin_auth_rejected", {
      reason: "email_not_allowlisted",
      user_id: data.user.id,
      email
    });
    return next(new HttpError(403, "forbidden"));
  }

  return next();
}
