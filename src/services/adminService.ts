import type { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { HttpError } from "../types/errors";
import { resolveRequestUser } from "./authService";

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase();
}

async function isAdminAllowlisted(email: string) {
  const { data, error } = await supabase
    .from("admin_allowlist")
    .select("email")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("admin_allowlist_lookup_error", {
      email,
      error: error.message
    });
    throw new HttpError(500, "internal_server_error", {
      details: {
        reason: "admin_allowlist_lookup_failed"
      }
    });
  }

  return Boolean(data?.email);
}

export async function getAdminStatusForEmail(email: string | undefined) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return {
      email: "",
      isAdmin: false
    };
  }

  const isAdmin = await isAdminAllowlisted(normalizedEmail);

  return {
    email: normalizedEmail,
    isAdmin
  };
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let user;
  try {
    user = await resolveRequestUser(req);
  } catch (error) {
    return next(error);
  }

  const email = normalizeEmail(user.email);

  if (!email) {
    console.warn("admin_authorization", {
      route: req.originalUrl,
      method: req.method,
      decision: "denied",
      reason: "missing_user_email",
      email: user.email
    });

    return res.status(403).json({
      error: "forbidden",
      detail: "email not in admin_allowlist",
      email: user.email ?? ""
    });
  }

  let isAllowlisted = false;
  try {
    isAllowlisted = await isAdminAllowlisted(email);
  } catch (error) {
    return next(error);
  }

  if (!isAllowlisted) {
    console.warn("admin_authorization", {
      route: req.originalUrl,
      method: req.method,
      decision: "denied",
      reason: "email_not_in_admin_allowlist",
      email
    });

    return res.status(403).json({
      error: "forbidden",
      detail: "email not in admin_allowlist",
      email
    });
  }

  req.adminUserId = user.id;
  req.adminUserEmail = email;

  console.log("admin_authorization", {
    route: req.originalUrl,
    method: req.method,
    decision: "allowed",
    email
  });

  return next();
}
