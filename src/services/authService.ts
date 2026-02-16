import { Request } from "express";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";

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

export async function resolveRequestUserId(req: Request, options?: { allowLegacyHeaderOnly?: boolean }) {
  const headerUserId = req.headers["x-user-id"] as string | undefined;
  const authHeader = req.headers.authorization;
  const token = getBearerToken(authHeader);

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new HttpError(401, "Invalid access token");
    }

    if (headerUserId && headerUserId !== data.user.id) {
      throw new HttpError(401, "x-user-id does not match token subject");
    }

    return data.user.id;
  }

  if (headerUserId && options?.allowLegacyHeaderOnly) {
    return headerUserId;
  }

  if (options?.allowLegacyHeaderOnly) {
    throw new HttpError(401, "Missing x-user-id header");
  }

  throw new HttpError(401, "Missing Authorization Bearer token");
}
