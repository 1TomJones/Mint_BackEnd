import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../types/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: "Validation failed",
      details: err.flatten()
    });
  }

  if (err instanceof HttpError) {
    const normalizedError = err.statusCode === 401 ? "unauthorized" : err.statusCode === 403 ? "forbidden" : err.message;

    return res.status(err.statusCode).json({
      ok: false,
      error: normalizedError,
      ...(err.errorCode ? { error_code: err.errorCode } : {}),
      ...(err.details ? { details: err.details } : {})
    });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({ ok: false, error: "Internal server error" });
}
