import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCourseHandler,
  deleteCourseHandler,
  getCourseHandler,
  listCoursesHandler,
  updateCourseHandler,
} from "./courses.controller.js";
import {
  createCourseRequestSchema,
  deleteCourseRequestSchema,
  getCourseRequestSchema,
  listCoursesRequestSchema,
  updateCourseRequestSchema,
} from "./courses.schemas.js";

/**
 * Rutas de cursos bajo /api/v1/courses.
 * Express 5: handlers async directo.
 */
export const coursesRouter = Router();

coursesRouter.get(
  "/",
  authenticate,
  validate(listCoursesRequestSchema),
  listCoursesHandler,
);

coursesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createCourseRequestSchema),
  createCourseHandler,
);

coursesRouter.get(
  "/:id",
  authenticate,
  validate(getCourseRequestSchema),
  getCourseHandler,
);

coursesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateCourseRequestSchema),
  updateCourseHandler,
);

coursesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteCourseRequestSchema),
  deleteCourseHandler,
);
