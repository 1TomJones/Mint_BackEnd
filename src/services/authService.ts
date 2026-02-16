import { Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { HttpError } from "../types/errors";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

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

export async function resolveRequestUser(req: Request) {
  let token: string | undefined;
  try {
    token = getBearerToken(req.headers.authorization);
  } catch (_error) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "invalid_auth_header"
    });
    throw new HttpError(401, "unauthorized");
  }

  if (!token) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "missing_auth_header"
    });
    throw new HttpError(401, "unauthorized");
  }

  const { data, error } = await supabaseServerAuthClient.auth.getUser(token);
  if (error || !data.user?.id) {
    const errorMessage = error?.message?.toLowerCase();
    const isExpiredToken = Boolean(errorMessage?.includes("expired"));

    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: isExpiredToken ? "expired_access_token" : "invalid_access_token",
      error_message: error?.message
    });

    throw new HttpError(401, isExpiredToken ? "expired" : "unauthorized");
  }

  return {
    id: data.user.id,
    email: data.user.email
  } satisfies AuthenticatedUser;
}

export async function resolveRequestUserId(req: Request) {
  const user = await resolveRequestUser(req);
  return user.id;
}
