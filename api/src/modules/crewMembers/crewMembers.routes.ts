import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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
  createCrewMemberHandler,
  deleteCrewMemberHandler,
  getCrewMemberHandler,
  listCrewMembersHandler,
  updateCrewMemberHandler,
} from "./crewMembers.controller.js";
import {
  createCrewMemberRequestSchema,
  deleteCrewMemberRequestSchema,
  getCrewMemberRequestSchema,
  listCrewMembersRequestSchema,
  updateCrewMemberRequestSchema,
} from "./crewMembers.schemas.js";

/**
 * Rutas de tripulantes bajo /api/v1/crew-members.
 * RBAC: embarcados.*; superadmin bypass.
 * Documentos anidados: /:id/documents.
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
