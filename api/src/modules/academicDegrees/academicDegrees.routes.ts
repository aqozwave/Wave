import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createAcademicDegreeHandler,
  deleteAcademicDegreeHandler,
  getAcademicDegreeHandler,
  listAcademicDegreesHandler,
  updateAcademicDegreeHandler,
} from "./academicDegrees.controller.js";
import {
  createAcademicDegreeRequestSchema,
  deleteAcademicDegreeRequestSchema,
  getAcademicDegreeRequestSchema,
  listAcademicDegreesRequestSchema,
  updateAcademicDegreeRequestSchema,
} from "./academicDegrees.schemas.js";

/**
 * Rutas de títulos bajo /api/v1/academic-degrees.
 * Express 5: handlers async directo.
 */
export const academicDegreesRouter = Router();

academicDegreesRouter.get(
  "/",
  authenticate,
  validate(listAcademicDegreesRequestSchema),
  listAcademicDegreesHandler,
);

academicDegreesRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_DEGREES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createAcademicDegreeRequestSchema),
  createAcademicDegreeHandler,
);

academicDegreesRouter.get(
  "/:id",
  authenticate,
  validate(getAcademicDegreeRequestSchema),
  getAcademicDegreeHandler,
);

academicDegreesRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_DEGREES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateAcademicDegreeRequestSchema),
  updateAcademicDegreeHandler,
);

academicDegreesRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_DEGREES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteAcademicDegreeRequestSchema),
  deleteAcademicDegreeHandler,
);
