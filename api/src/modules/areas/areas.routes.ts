import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createAreaHandler,
  deleteAreaHandler,
  getAreaHandler,
  listAreasHandler,
  updateAreaHandler,
} from "./areas.controller.js";
import {
  createAreaRequestSchema,
  deleteAreaRequestSchema,
  getAreaRequestSchema,
  listAreasRequestSchema,
  updateAreaRequestSchema,
} from "./areas.schemas.js";

/**
 * Rutas de áreas bajo /api/v1/areas.
 * Express 5: handlers async directo.
 */
export const areasRouter = Router();

areasRouter.get(
  "/",
  authenticate,
  validate(listAreasRequestSchema),
  listAreasHandler,
);

areasRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_AREAS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createAreaRequestSchema),
  createAreaHandler,
);

areasRouter.get(
  "/:id",
  authenticate,
  validate(getAreaRequestSchema),
  getAreaHandler,
);

areasRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_AREAS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateAreaRequestSchema),
  updateAreaHandler,
);

areasRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_AREAS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteAreaRequestSchema),
  deleteAreaHandler,
);
