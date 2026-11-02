import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import { listExpiringCrewMemberCoursesHandler } from "./crewMemberCourses.controller.js";
import { listExpiringCrewMemberCoursesRequestSchema } from "./crewMemberCourses.schemas.js";

/**
 * Listado global de asignaciones bajo /api/v1/crew-member-courses.
 * Separado del nested /crew-members/:id/courses (ficha).
 */
export const crewMemberCoursesGlobalRouter = Router();

crewMemberCoursesGlobalRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_LIBRETAS,
    PERMISSION_ACTION.READ,
  ),
  validate(listExpiringCrewMemberCoursesRequestSchema),
  listExpiringCrewMemberCoursesHandler,
);
