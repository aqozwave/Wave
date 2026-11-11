import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  cancelTrainingSessionHandler,
  completeTrainingSessionHandler,
  createTrainingSessionHandler,
  getTrainingSessionHandler,
  listTrainingSessionsHandler,
  updateTrainingSessionHandler,
  uploadTrainingSessionCertificateHandler,
} from "./trainingSessions.controller.js";
import {
  cancelTrainingSessionRequestSchema,
  completeTrainingSessionRequestSchema,
  createTrainingSessionRequestSchema,
  getTrainingSessionRequestSchema,
  listTrainingSessionsRequestSchema,
  updateTrainingSessionRequestSchema,
  uploadTrainingSessionCertificateRequestSchema,
} from "./trainingSessions.schemas.js";

/**
 * Sesiones de capacitación (grupal/individual) bajo /api/v1/training-sessions.
 * Sin requireTenantManager: el prevencionista tiene trainings.*.
 */
export const trainingSessionsRouter = Router();

trainingSessionsRouter.get(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(listTrainingSessionsRequestSchema),
  listTrainingSessionsHandler,
);

trainingSessionsRouter.post(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.CREATE),
  validate(createTrainingSessionRequestSchema),
  createTrainingSessionHandler,
);

trainingSessionsRouter.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(getTrainingSessionRequestSchema),
  getTrainingSessionHandler,
);

trainingSessionsRouter.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(updateTrainingSessionRequestSchema),
  updateTrainingSessionHandler,
);

trainingSessionsRouter.post(
  "/:id/certificate",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(uploadTrainingSessionCertificateRequestSchema),
  uploadTrainingSessionCertificateHandler,
);

trainingSessionsRouter.post(
  "/:id/complete",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(completeTrainingSessionRequestSchema),
  completeTrainingSessionHandler,
);

trainingSessionsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.DEACTIVATE),
  validate(cancelTrainingSessionRequestSchema),
  cancelTrainingSessionHandler,
);
