import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createAccreditationDocumentHandler,
  createAccreditationPersonDocumentHandler,
  deleteAccreditationDocumentHandler,
  deleteAccreditationPersonDocumentHandler,
  downloadAccreditationDocumentHandler,
  downloadAccreditationPersonDocumentHandler,
  listAccreditationDocumentsHandler,
  listAccreditationPersonDocumentsHandler,
  validateAccreditationDocumentHandler,
  validateAccreditationPersonDocumentHandler,
} from "../accreditationDocuments/accreditationDocuments.controller.js";
import {
  createAccreditationDocumentRequestSchema,
  createAccreditationPersonDocumentRequestSchema,
  deleteAccreditationDocumentRequestSchema,
  deleteAccreditationPersonDocumentRequestSchema,
  downloadAccreditationDocumentRequestSchema,
  downloadAccreditationPersonDocumentRequestSchema,
  listAccreditationDocumentsRequestSchema,
  listAccreditationPersonDocumentsRequestSchema,
  validateAccreditationDocumentRequestSchema,
  validateAccreditationPersonDocumentRequestSchema,
} from "../accreditationDocuments/accreditationDocuments.schemas.js";
import {
  approveAccreditationHandler,
  clearAdditionalDocumentsRequestHandler,
  createAccreditationHandler,
  deleteAccreditationHandler,
  getAccreditationHandler,
  listAccreditationHistoryHandler,
  listAccreditationsHandler,
  rejectAccreditationHandler,
  requestAdditionalDocumentsHandler,
  returnAccreditationHandler,
  submitAccreditationHandler,
} from "./accreditations.controller.js";
import {
  approveAccreditationRequestSchema,
  clearAdditionalDocsRequestSchema,
  createAccreditationRequestSchema,
  deleteAccreditationRequestSchema,
  getAccreditationRequestSchema,
  listAccreditationHistoryRequestSchema,
  listAccreditationsRequestSchema,
  rejectAccreditationRequestSchema,
  requestAdditionalDocsRequestSchema,
  returnAccreditationRequestSchema,
  submitAccreditationRequestSchema,
} from "./accreditations.schemas.js";

/**
 * Habilitaciones bajo /api/v1/accreditations (P2 bandeja).
 * Mutaciones por permiso (prevencionista puede; no exige admin).
 * Submit también con accreditations.update hasta existir portal contratista fino.
 */
export const accreditationsRouter = Router();

accreditationsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listAccreditationsRequestSchema),
  listAccreditationsHandler,
);

accreditationsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createAccreditationRequestSchema),
  createAccreditationHandler,
);

accreditationsRouter.get(
  "/:id/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listAccreditationDocumentsRequestSchema),
  listAccreditationDocumentsHandler,
);

accreditationsRouter.post(
  "/:id/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(createAccreditationDocumentRequestSchema),
  createAccreditationDocumentHandler,
);

accreditationsRouter.get(
  "/:id/documents/:documentId/download",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(downloadAccreditationDocumentRequestSchema),
  downloadAccreditationDocumentHandler,
);

accreditationsRouter.post(
  "/:id/documents/:documentId/validate",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(validateAccreditationDocumentRequestSchema),
  validateAccreditationDocumentHandler,
);

accreditationsRouter.delete(
  "/:id/documents/:documentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(deleteAccreditationDocumentRequestSchema),
  deleteAccreditationDocumentHandler,
);

accreditationsRouter.get(
  "/:id/people/:personId/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listAccreditationPersonDocumentsRequestSchema),
  listAccreditationPersonDocumentsHandler,
);

accreditationsRouter.post(
  "/:id/people/:personId/documents",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(createAccreditationPersonDocumentRequestSchema),
  createAccreditationPersonDocumentHandler,
);

accreditationsRouter.get(
  "/:id/people/:personId/documents/:documentId/download",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(downloadAccreditationPersonDocumentRequestSchema),
  downloadAccreditationPersonDocumentHandler,
);

accreditationsRouter.post(
  "/:id/people/:personId/documents/:documentId/validate",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(validateAccreditationPersonDocumentRequestSchema),
  validateAccreditationPersonDocumentHandler,
);

accreditationsRouter.delete(
  "/:id/people/:personId/documents/:documentId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(deleteAccreditationPersonDocumentRequestSchema),
  deleteAccreditationPersonDocumentHandler,
);

accreditationsRouter.get(
  "/:id/history",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listAccreditationHistoryRequestSchema),
  listAccreditationHistoryHandler,
);

accreditationsRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(getAccreditationRequestSchema),
  getAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/submit",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(submitAccreditationRequestSchema),
  submitAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/approve",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(approveAccreditationRequestSchema),
  approveAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/return",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(returnAccreditationRequestSchema),
  returnAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/reject",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(rejectAccreditationRequestSchema),
  rejectAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/request-additional-docs",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(requestAdditionalDocsRequestSchema),
  requestAdditionalDocumentsHandler,
);

accreditationsRouter.post(
  "/:id/clear-additional-docs",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(clearAdditionalDocsRequestSchema),
  clearAdditionalDocumentsRequestHandler,
);

accreditationsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(deleteAccreditationRequestSchema),
  deleteAccreditationHandler,
);
