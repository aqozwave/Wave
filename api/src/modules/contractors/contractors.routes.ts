import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createContractorHandler,
  createContractorPersonHandler,
  createMyContractorAccreditationDocumentHandler,
  createMyContractorPersonDocumentHandler,
  createMyContractorPersonHandler,
  deleteContractorHandler,
  deleteContractorPersonHandler,
  deleteMyContractorPersonHandler,
  downloadMyContractorAccreditationDocumentHandler,
  downloadMyContractorPersonDocumentHandler,
  getContractorHandler,
  getContractorPortalSummaryHandler,
  getMyContractorAccreditationHandler,
  getMyContractorOrganizationHandler,
  inviteContractorUserHandler,
  listContractorPeopleHandler,
  listContractorUsersHandler,
  listContractorsHandler,
  listMyContractorAccreditationDocumentsHandler,
  listMyContractorPeopleHandler,
  listMyContractorPersonDocumentsHandler,
  submitMyContractorAccreditationHandler,
  updateContractorHandler,
  updateContractorPersonHandler,
  updateMyContractorOrganizationHandler,
  updateMyContractorPersonHandler,
} from "./contractors.controller.js";
import {
  createContractorPersonRequestSchema,
  createContractorPortalDocumentRequestSchema,
  createContractorRequestSchema,
  createMyContractorPersonDocumentRequestSchema,
  createMyContractorPersonRequestSchema,
  deleteContractorPersonRequestSchema,
  deleteContractorRequestSchema,
  deleteMyContractorPersonRequestSchema,
  downloadContractorPortalDocumentRequestSchema,
  downloadMyContractorPersonDocumentRequestSchema,
  getContractorPortalSummaryRequestSchema,
  getContractorRequestSchema,
  inviteContractorUserRequestSchema,
  listContractorPeopleRequestSchema,
  listContractorUsersRequestSchema,
  listContractorsRequestSchema,
  listMyContractorPeopleRequestSchema,
  listMyContractorPersonDocumentsRequestSchema,
  updateContractorPersonRequestSchema,
  updateContractorRequestSchema,
  updateMyContractorOrganizationRequestSchema,
  updateMyContractorPersonRequestSchema,
} from "./contractors.schemas.js";

/**
 * Organizaciones contratistas bajo /api/v1/contractors (P2).
 * Lectura: contractors.read. Mutaciones: admin/superadmin + create/update/deactivate.
 * Módulo contractors on se valida en el service (por businessId de la org).
 */
export const contractorsRouter = Router();

/** Portal E*: usuario externo (organizationId). Sin requirePermission. */
contractorsRouter.get(
  "/me",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  getMyContractorOrganizationHandler,
);

contractorsRouter.patch(
  "/me",
  authenticate,
  validate(updateMyContractorOrganizationRequestSchema),
  updateMyContractorOrganizationHandler,
);

contractorsRouter.get(
  "/me/summary",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  getContractorPortalSummaryHandler,
);

contractorsRouter.get(
  "/me/accreditation",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  getMyContractorAccreditationHandler,
);

contractorsRouter.get(
  "/me/accreditation/documents",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  listMyContractorAccreditationDocumentsHandler,
);

contractorsRouter.post(
  "/me/accreditation/documents",
  authenticate,
  validate(createContractorPortalDocumentRequestSchema),
  createMyContractorAccreditationDocumentHandler,
);

contractorsRouter.get(
  "/me/accreditation/documents/:documentId/download",
  authenticate,
  validate(downloadContractorPortalDocumentRequestSchema),
  downloadMyContractorAccreditationDocumentHandler,
);

contractorsRouter.post(
  "/me/accreditation/submit",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  submitMyContractorAccreditationHandler,
);

/** Portal E5: personal de la org del usuario externo. */
contractorsRouter.get(
  "/me/people",
  authenticate,
  validate(listMyContractorPeopleRequestSchema),
  listMyContractorPeopleHandler,
);

contractorsRouter.post(
  "/me/people",
  authenticate,
  validate(createMyContractorPersonRequestSchema),
  createMyContractorPersonHandler,
);

contractorsRouter.patch(
  "/me/people/:personId",
  authenticate,
  validate(updateMyContractorPersonRequestSchema),
  updateMyContractorPersonHandler,
);

contractorsRouter.delete(
  "/me/people/:personId",
  authenticate,
  validate(deleteMyContractorPersonRequestSchema),
  deleteMyContractorPersonHandler,
);

contractorsRouter.get(
  "/me/accreditation/people/:personId/documents",
  authenticate,
  validate(listMyContractorPersonDocumentsRequestSchema),
  listMyContractorPersonDocumentsHandler,
);

contractorsRouter.post(
  "/me/accreditation/people/:personId/documents",
  authenticate,
  validate(createMyContractorPersonDocumentRequestSchema),
  createMyContractorPersonDocumentHandler,
);

contractorsRouter.get(
  "/me/accreditation/people/:personId/documents/:documentId/download",
  authenticate,
  validate(downloadMyContractorPersonDocumentRequestSchema),
  downloadMyContractorPersonDocumentHandler,
);

contractorsRouter.get(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.READ),
  validate(listContractorsRequestSchema),
  listContractorsHandler,
);

contractorsRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.CREATE),
  validate(createContractorRequestSchema),
  createContractorHandler,
);

contractorsRouter.get(
  "/:id/users",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.READ),
  validate(listContractorUsersRequestSchema),
  listContractorUsersHandler,
);

contractorsRouter.post(
  "/:id/users",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.CREATE),
  validate(inviteContractorUserRequestSchema),
  inviteContractorUserHandler,
);

contractorsRouter.get(
  "/:id/people",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.READ),
  validate(listContractorPeopleRequestSchema),
  listContractorPeopleHandler,
);

contractorsRouter.post(
  "/:id/people",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.CREATE),
  validate(createContractorPersonRequestSchema),
  createContractorPersonHandler,
);

contractorsRouter.patch(
  "/:id/people/:personId",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.UPDATE),
  validate(updateContractorPersonRequestSchema),
  updateContractorPersonHandler,
);

contractorsRouter.delete(
  "/:id/people/:personId",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.CONTRACTORS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteContractorPersonRequestSchema),
  deleteContractorPersonHandler,
);

contractorsRouter.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.READ),
  validate(getContractorRequestSchema),
  getContractorHandler,
);

contractorsRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(PERMISSION_RESOURCE.CONTRACTORS, PERMISSION_ACTION.UPDATE),
  validate(updateContractorRequestSchema),
  updateContractorHandler,
);

contractorsRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.CONTRACTORS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteContractorRequestSchema),
  deleteContractorHandler,
);
