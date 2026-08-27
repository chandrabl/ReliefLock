import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError || err?.name === 'ZodError') {
    res.status(400).json({ error: "Validation failed", details: err.flatten ? err.flatten() : err });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.name === 'ValidationError') {
    res.status(400).json({ error: "Mongoose Validation failed", details: err.message });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ error: "Duplicate key error", details: err.keyValue });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error", message: err?.message });
}
