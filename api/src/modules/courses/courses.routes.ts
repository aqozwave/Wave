import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_CATALOG,
    PERMISSION_ACTION.CREATE,
  ),
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
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_CATALOG,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateCourseRequestSchema),
  updateCourseHandler,
);

coursesRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_CATALOG,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCourseRequestSchema),
  deleteCourseHandler,
);
