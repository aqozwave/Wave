import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import { getDashboardSummaryHandler } from "./dashboard.controller.js";
import { getDashboardSummaryRequestSchema } from "./dashboard.schemas.js";

/**
 * Dashboard bajo /api/v1/dashboard.
 * Lecturas agregadas para Panel web e iOS futuro.
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.DASHBOARD, PERMISSION_ACTION.READ),
  validate(getDashboardSummaryRequestSchema),
  getDashboardSummaryHandler,
);
