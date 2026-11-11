import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createTravesiaHandler,
  deleteTravesiaHandler,
  getTravesiaHandler,
  listTravesiasHandler,
  updateTravesiaHandler,
} from "./travesias.controller.js";
import {
  createTravesiaRequestSchema,
  deleteTravesiaRequestSchema,
  getTravesiaRequestSchema,
  listTravesiasRequestSchema,
  updateTravesiaRequestSchema,
} from "./travesias.schemas.js";

/**
 * Rutas de travesías bajo /api/v1/travesias.
 * Express 5: handlers async directo.
 */
export const travesiasRouter = Router();

travesiasRouter.get(
  "/",
  authenticate,
  validate(listTravesiasRequestSchema),
  listTravesiasHandler,
);

travesiasRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_TRAVESIAS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createTravesiaRequestSchema),
  createTravesiaHandler,
);

travesiasRouter.get(
  "/:id",
  authenticate,
  validate(getTravesiaRequestSchema),
  getTravesiaHandler,
);

travesiasRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_TRAVESIAS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateTravesiaRequestSchema),
  updateTravesiaHandler,
);

travesiasRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_TRAVESIAS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteTravesiaRequestSchema),
  deleteTravesiaHandler,
);
