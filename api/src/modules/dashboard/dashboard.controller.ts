import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  getDashboardSummaryResponseSchema,
  type GetDashboardSummaryQuery,
} from "./dashboard.schemas.js";
import { getDashboardSummary } from "./dashboard.service.js";

/**
 * GET /dashboard/summary — KPIs + próximos vencimientos del Panel.
 */
export async function getDashboardSummaryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as GetDashboardSummaryQuery;
  const result = await getDashboardSummary(req.user, query);
  res.status(200).json(getDashboardSummaryResponseSchema.parse(result));
}
