import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createWorkNoticeHandler,
  getWorkNoticeHandler,
  listWorkNoticesHandler,
} from "./workNotices.controller.js";
import {
  createWorkNoticeRequestSchema,
  getWorkNoticeRequestSchema,
  listWorkNoticesRequestSchema,
} from "./workNotices.schemas.js";

/**
 * Avisos de trabajo bajo /api/v1/work-notices (P4 · AT1/AT2).
 * Módulo business: work_permits. Permiso: work_notices.*.
 */
export const workNoticesRouter = Router();

workNoticesRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_NOTICES,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkNoticesRequestSchema),
  listWorkNoticesHandler,
);

workNoticesRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_NOTICES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createWorkNoticeRequestSchema),
  createWorkNoticeHandler,
);

workNoticesRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_NOTICES,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkNoticeRequestSchema),
  getWorkNoticeHandler,
);
