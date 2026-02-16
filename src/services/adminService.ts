import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../types/errors";
import { resolveRequestUser } from "./authService";

const adminEmailAllowlist = new Set(
  (env.ADMIN_ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  let user;
  try {
    user = await resolveRequestUser(req);
  } catch (error) {
    return next(error);
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "missing_user_email",
      user_id: user.id
    });
    return next(new HttpError(403, "forbidden"));
  }

  if (!adminEmailAllowlist.has(email)) {
    console.warn("admin_auth_rejected", {
      route: req.originalUrl,
      method: req.method,
      reason: "email_not_allowlisted",
      user_id: user.id,
      email
    });
    return next(new HttpError(403, "forbidden"));
  }

  return next();
}
