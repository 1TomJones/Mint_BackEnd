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
    throw new HttpError(401, "Invalid Authorization header");
  }

  return token;
}

export async function resolveRequestUser(req: Request) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    throw new HttpError(401, "Missing access token");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new HttpError(401, "Invalid access token");
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
