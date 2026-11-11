import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createMuelleHandler,
  deleteMuelleHandler,
  getMuelleHandler,
  listMuellesHandler,
  updateMuelleHandler,
} from "./muelles.controller.js";
import {
  createMuelleRequestSchema,
  deleteMuelleRequestSchema,
  getMuelleRequestSchema,
  listMuellesRequestSchema,
  updateMuelleRequestSchema,
} from "./muelles.schemas.js";

/**
 * Rutas de muelles bajo /api/v1/muelles.
 * Express 5: handlers async directo.
 */
export const muellesRouter = Router();

muellesRouter.get(
  "/",
  authenticate,
  validate(listMuellesRequestSchema),
  listMuellesHandler,
);

muellesRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_MUELLES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createMuelleRequestSchema),
  createMuelleHandler,
);

muellesRouter.get(
  "/:id",
  authenticate,
  validate(getMuelleRequestSchema),
  getMuelleHandler,
);

muellesRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_MUELLES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateMuelleRequestSchema),
  updateMuelleHandler,
);

muellesRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_MUELLES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteMuelleRequestSchema),
  deleteMuelleHandler,
);
