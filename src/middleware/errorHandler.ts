import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../types/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten()
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({ error: "Internal server error" });
}
