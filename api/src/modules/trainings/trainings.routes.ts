import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createTrainingHandler,
  deleteTrainingHandler,
  getTrainingHandler,
  listTrainingsHandler,
  updateTrainingHandler,
} from "./trainings.controller.js";
import {
  createTrainingRequestSchema,
  deleteTrainingRequestSchema,
  getTrainingRequestSchema,
  listTrainingsRequestSchema,
  updateTrainingRequestSchema,
} from "./trainings.schemas.js";

/**
 * Catálogo capacitaciones Prevención bajo /api/v1/trainings.
 * Manda el permiso del rol (trainings.read/create/update/deactivate), no el internalRol.
 */
export const trainingsRouter = Router();

trainingsRouter.get(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(listTrainingsRequestSchema),
  listTrainingsHandler,
);

trainingsRouter.post(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.CREATE),
  validate(createTrainingRequestSchema),
  createTrainingHandler,
);

trainingsRouter.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(getTrainingRequestSchema),
  getTrainingHandler,
);

trainingsRouter.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(updateTrainingRequestSchema),
  updateTrainingHandler,
);

trainingsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.TRAININGS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteTrainingRequestSchema),
  deleteTrainingHandler,
);
