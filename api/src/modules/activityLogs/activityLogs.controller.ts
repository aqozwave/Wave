import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  listActivityLogsResponseSchema,
  type ListActivityLogsQuery,
} from "./activityLogs.schemas.js";
import { listActivityLogs } from "./activityLogs.service.js";

/**
 * GET /activity-logs — listado de auditoría (superadmin).
 */
export async function listActivityLogsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListActivityLogsQuery;
  const result = await listActivityLogs(req.user, query);
  res.status(200).json(listActivityLogsResponseSchema.parse(result));
}
