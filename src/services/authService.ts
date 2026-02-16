import { Request } from "express";
import jwt, { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { env } from "../config/env";
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

export async function resolveRequestUser(req: Request, options?: { allowLegacyHeaderOnly?: boolean }) {
  const headerUserId = req.headers["x-user-id"] as string | undefined;
  const authHeader = req.headers.authorization;
  const token = getBearerToken(authHeader);

  if (token) {
    try {
      const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET) as JwtPayload;
      const userId = typeof decoded.sub === "string" ? decoded.sub : undefined;
      if (!userId) {
        throw new HttpError(401, "Invalid access token");
      }

      if (headerUserId && headerUserId !== userId) {
        throw new HttpError(401, "x-user-id does not match token subject");
      }

      return {
        id: userId,
        email: typeof decoded.email === "string" ? decoded.email : undefined
      } satisfies AuthenticatedUser;
    } catch (error) {
      if (error instanceof TokenExpiredError || (error as Error).name === "TokenExpiredError") {
        throw new HttpError(401, "JWT expired");
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(401, "Invalid access token");
    }
  }

  if (headerUserId && options?.allowLegacyHeaderOnly) {
    const { data, error } = await supabase.auth.admin.getUserById(headerUserId);
    if (error || !data.user?.id) {
      throw new HttpError(401, "Invalid x-user-id header");
    }

    return data.user;
  }

  if (options?.allowLegacyHeaderOnly) {
    throw new HttpError(401, "Missing x-user-id header");
  }

  throw new HttpError(401, "Missing access token");
}

export async function resolveRequestUserId(req: Request, options?: { allowLegacyHeaderOnly?: boolean }) {
  const user = await resolveRequestUser(req, options);
  return user.id;
}
