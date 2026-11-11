import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import { listActivityLogsHandler } from "./activityLogs.controller.js";
import { listActivityLogsRequestSchema } from "./activityLogs.schemas.js";

/**
 * Auditoría bajo /api/v1/activity-logs.
 * RBAC: sistema.activity_logs:read (superadmin bypass).
 */
export const activityLogsRouter = Router();

activityLogsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.SISTEMA_ACTIVITY_LOGS,
    PERMISSION_ACTION.READ,
  ),
  validate(listActivityLogsRequestSchema),
  listActivityLogsHandler,
);
