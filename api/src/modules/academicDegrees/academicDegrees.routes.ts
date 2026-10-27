import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
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
  requireTenantManager,
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
  requireTenantManager,
  validate(updateAcademicDegreeRequestSchema),
  updateAcademicDegreeHandler,
);

academicDegreesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteAcademicDegreeRequestSchema),
  deleteAcademicDegreeHandler,
);
