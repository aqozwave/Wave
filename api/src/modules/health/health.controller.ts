import type { Request, Response } from "express";
import { healthResponseSchema } from "./health.schemas.js";
import { getHealth } from "./health.service.js";

export function getHealthHandler(_req: Request, res: Response): void {
  const body = healthResponseSchema.parse(getHealth());
  res.status(200).json(body);
}
