import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import { listActivityLogsHandler } from "./activityLogs.controller.js";
import { listActivityLogsRequestSchema } from "./activityLogs.schemas.js";

/**
 * Auditoría bajo /api/v1/activity-logs.
 * Solo superadmin (portal viejo ActivityLogsPage).
 */
export const activityLogsRouter = Router();

activityLogsRouter.get(
  "/",
  authenticate,
  requireSuperadmin,
  validate(listActivityLogsRequestSchema),
  listActivityLogsHandler,
);
