import { Request } from "express";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

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

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "invalid_access_token",
      error_message: error?.message
    });
    throw new HttpError(401, "unauthorized");
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
