import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createWorkPermitHandler,
  getWorkPermitHandler,
  listWorkPermitsHandler,
  submitWorkPermitHandler,
} from "./workPermits.controller.js";
import {
  createWorkPermitRequestSchema,
  getWorkPermitRequestSchema,
  listWorkPermitsRequestSchema,
  submitWorkPermitRequestSchema,
} from "./workPermits.schemas.js";

/**
 * Permisos de trabajo bajo /api/v1/work-permits.
 * Crear = Prevención a partir de un aviso (status to_complete).
 */
export const workPermitsRouter = Router();

workPermitsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkPermitsRequestSchema),
  listWorkPermitsHandler,
);

workPermitsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createWorkPermitRequestSchema),
  createWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/submit",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(submitWorkPermitRequestSchema),
  submitWorkPermitHandler,
);

workPermitsRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkPermitRequestSchema),
  getWorkPermitHandler,
);
