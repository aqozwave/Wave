import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCrewMemberMuelleHandler,
  createCrewMemberTravesiaHandler,
  deleteCrewMemberMuelleHandler,
  deleteCrewMemberTravesiaHandler,
  listCrewMemberMuellesHandler,
  listCrewMemberTravesiasHandler,
} from "../crewMemberAssignments/crewMemberAssignments.controller.js";
import {
  createCrewMemberMuelleRequestSchema,
  createCrewMemberTravesiaRequestSchema,
  deleteCrewMemberMuelleRequestSchema,
  deleteCrewMemberTravesiaRequestSchema,
  listCrewMemberMuellesRequestSchema,
  listCrewMemberTravesiasRequestSchema,
} from "../crewMemberAssignments/crewMemberAssignments.schemas.js";
import {
  createCrewMemberCourseHandler,
  deleteCrewMemberCourseHandler,
  getCrewMemberCourseHandler,
  listCrewMemberCoursesHandler,
  updateCrewMemberCourseHandler,
} from "../crewMemberCourses/crewMemberCourses.controller.js";
import {
  createCrewMemberCourseRequestSchema,
  deleteCrewMemberCourseRequestSchema,
  getCrewMemberCourseRequestSchema,
  listCrewMemberCoursesRequestSchema,
  updateCrewMemberCourseRequestSchema,
} from "../crewMemberCourses/crewMemberCourses.schemas.js";
import {
  createCrewMemberTrainingHandler,
  deleteCrewMemberTrainingHandler,
  getCrewMemberTrainingHandler,
  listCrewMemberTrainingsHandler,
  updateCrewMemberTrainingHandler,
  uploadCrewMemberTrainingEvidenceHandler,
} from "../crewMemberTrainings/crewMemberTrainings.controller.js";
import {
  createCrewMemberTrainingRequestSchema,
  deleteCrewMemberTrainingRequestSchema,
  getCrewMemberTrainingRequestSchema,
  listCrewMemberTrainingsRequestSchema,
  updateCrewMemberTrainingRequestSchema,
  uploadCrewMemberTrainingEvidenceRequestSchema,
} from "../crewMemberTrainings/crewMemberTrainings.schemas.js";
import {
  createCrewMemberDocumentHandler,
  deleteCrewMemberDocumentHandler,
  downloadCrewMemberDocumentHandler,
  listCrewMemberDocumentsHandler,
} from "../crewMemberDocuments/crewMemberDocuments.controller.js";
import {
  createCrewMemberDocumentRequestSchema,
  deleteCrewMemberDocumentRequestSchema,
  downloadCrewMemberDocumentRequestSchema,
  listCrewMemberDocumentsRequestSchema,
} from "../crewMemberDocuments/crewMemberDocuments.schemas.js";
import {
  changeCrewMemberAccessRoleHandler,
  createCrewMemberHandler,
  deleteCrewMemberHandler,
  getCrewMemberAccessHandler,
  getCrewMemberHandler,
  grantCrewMemberAccessHandler,
  listCrewMemberHistoryHandler,
  listCrewMembersHandler,
  revokeCrewMemberAccessHandler,
  updateCrewMemberHandler,
} from "./crewMembers.controller.js";
import {
  changeCrewMemberAccessRoleRequestSchema,
  createCrewMemberRequestSchema,
  deleteCrewMemberRequestSchema,
  getCrewMemberAccessRequestSchema,
  getCrewMemberRequestSchema,
  grantCrewMemberAccessRequestSchema,
  listCrewMemberHistoryRequestSchema,
  listCrewMembersRequestSchema,
  revokeCrewMemberAccessRequestSchema,
  updateCrewMemberRequestSchema,
} from "./crewMembers.schemas.js";

/**
 * Rutas de tripulantes bajo /api/v1/crew-members.
 * RBAC: embarcados.*; superadmin bypass.
 * Anidados: /:id/documents, /:id/courses, muelles, travesías, access.
 */
export const crewMembersRouter = Router();

crewMembersRouter.get(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(listCrewMembersRequestSchema),
  listCrewMembersHandler,
);

crewMembersRouter.post(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.CREATE),
  validate(createCrewMemberRequestSchema),
  createCrewMemberHandler,
);

crewMembersRouter.get(
  "/:id/history",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(listCrewMemberHistoryRequestSchema),
  listCrewMemberHistoryHandler,
);

crewMembersRouter.get(
  "/:id/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS_DOCS,
    PERMISSION_ACTION.READ,
  ),
  validate(listCrewMemberDocumentsRequestSchema),
  listCrewMemberDocumentsHandler,
);

crewMembersRouter.post(
  "/:id/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS_DOCS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createCrewMemberDocumentRequestSchema),
  createCrewMemberDocumentHandler,
);

crewMembersRouter.get(
  "/:id/documents/:documentId/download",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS_DOCS,
    PERMISSION_ACTION.READ,
  ),
  validate(downloadCrewMemberDocumentRequestSchema),
  downloadCrewMemberDocumentHandler,
);

crewMembersRouter.delete(
  "/:id/documents/:documentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS_DOCS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberDocumentRequestSchema),
  deleteCrewMemberDocumentHandler,
);

crewMembersRouter.get(
  "/:id/courses",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
    PERMISSION_ACTION.READ,
  ),
  validate(listCrewMemberCoursesRequestSchema),
  listCrewMemberCoursesHandler,
);

crewMembersRouter.post(
  "/:id/courses",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createCrewMemberCourseRequestSchema),
  createCrewMemberCourseHandler,
);

crewMembersRouter.get(
  "/:id/courses/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
    PERMISSION_ACTION.READ,
  ),
  validate(getCrewMemberCourseRequestSchema),
  getCrewMemberCourseHandler,
);

crewMembersRouter.patch(
  "/:id/courses/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateCrewMemberCourseRequestSchema),
  updateCrewMemberCourseHandler,
);

crewMembersRouter.delete(
  "/:id/courses/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberCourseRequestSchema),
  deleteCrewMemberCourseHandler,
);

crewMembersRouter.get(
  "/:id/trainings",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(listCrewMemberTrainingsRequestSchema),
  listCrewMemberTrainingsHandler,
);

crewMembersRouter.post(
  "/:id/trainings",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.CREATE),
  validate(createCrewMemberTrainingRequestSchema),
  createCrewMemberTrainingHandler,
);

crewMembersRouter.get(
  "/:id/trainings/:assignmentId",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.READ),
  validate(getCrewMemberTrainingRequestSchema),
  getCrewMemberTrainingHandler,
);

crewMembersRouter.patch(
  "/:id/trainings/:assignmentId",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(updateCrewMemberTrainingRequestSchema),
  updateCrewMemberTrainingHandler,
);

crewMembersRouter.delete(
  "/:id/trainings/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.TRAININGS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberTrainingRequestSchema),
  deleteCrewMemberTrainingHandler,
);

crewMembersRouter.post(
  "/:id/trainings/:assignmentId/evidence",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.TRAININGS, PERMISSION_ACTION.UPDATE),
  validate(uploadCrewMemberTrainingEvidenceRequestSchema),
  uploadCrewMemberTrainingEvidenceHandler,
);

crewMembersRouter.get(
  "/:id/muelles",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(listCrewMemberMuellesRequestSchema),
  listCrewMemberMuellesHandler,
);

crewMembersRouter.post(
  "/:id/muelles",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(createCrewMemberMuelleRequestSchema),
  createCrewMemberMuelleHandler,
);

crewMembersRouter.delete(
  "/:id/muelles/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberMuelleRequestSchema),
  deleteCrewMemberMuelleHandler,
);

crewMembersRouter.get(
  "/:id/travesias",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(listCrewMemberTravesiasRequestSchema),
  listCrewMemberTravesiasHandler,
);

crewMembersRouter.post(
  "/:id/travesias",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(createCrewMemberTravesiaRequestSchema),
  createCrewMemberTravesiaHandler,
);

crewMembersRouter.delete(
  "/:id/travesias/:assignmentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberTravesiaRequestSchema),
  deleteCrewMemberTravesiaHandler,
);

/** Acceso portal (P7 · Figma D44–D46): estado / otorgar / rol / desvincular. */
crewMembersRouter.get(
  "/:id/access",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(getCrewMemberAccessRequestSchema),
  getCrewMemberAccessHandler,
);

crewMembersRouter.post(
  "/:id/access",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(grantCrewMemberAccessRequestSchema),
  grantCrewMemberAccessHandler,
);

crewMembersRouter.patch(
  "/:id/access",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(changeCrewMemberAccessRoleRequestSchema),
  changeCrewMemberAccessRoleHandler,
);

crewMembersRouter.delete(
  "/:id/access",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(revokeCrewMemberAccessRequestSchema),
  revokeCrewMemberAccessHandler,
);

crewMembersRouter.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.READ),
  validate(getCrewMemberRequestSchema),
  getCrewMemberHandler,
);

crewMembersRouter.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.EMBARCADOS, PERMISSION_ACTION.UPDATE),
  validate(updateCrewMemberRequestSchema),
  updateCrewMemberHandler,
);

crewMembersRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.EMBARCADOS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCrewMemberRequestSchema),
  deleteCrewMemberHandler,
);
