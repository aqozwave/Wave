import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createDocumentTypeHandler,
  deleteDocumentTypeHandler,
  getDocumentTypeHandler,
  listDocumentTypesHandler,
  updateDocumentTypeHandler,
} from "./documentTypes.controller.js";
import {
  createDocumentTypeRequestSchema,
  deleteDocumentTypeRequestSchema,
  getDocumentTypeRequestSchema,
  listDocumentTypesRequestSchema,
  updateDocumentTypeRequestSchema,
} from "./documentTypes.schemas.js";

/**
 * Maestro tipos de documento bajo /api/v1/document-types.
 * Lectura: permiso read. Mutaciones: admin/superadmin + permiso create/update/deactivate.
 */
export const documentTypesRouter = Router();

documentTypesRouter.get(
  "/",
  authenticate,
  /** Catálogo maestros o pantalla Packs (accreditation_packs). */
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
      action: PERMISSION_ACTION.READ,
    },
    {
      resource: PERMISSION_RESOURCE.ACCREDITATION_PACKS,
      action: PERMISSION_ACTION.READ,
    },
  ]),
  validate(listDocumentTypesRequestSchema),
  listDocumentTypesHandler,
);

documentTypesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createDocumentTypeRequestSchema),
  createDocumentTypeHandler,
);

documentTypesRouter.get(
  "/:id",
  authenticate,
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
      action: PERMISSION_ACTION.READ,
    },
    {
      resource: PERMISSION_RESOURCE.ACCREDITATION_PACKS,
      action: PERMISSION_ACTION.READ,
    },
  ]),
  validate(getDocumentTypeRequestSchema),
  getDocumentTypeHandler,
);

documentTypesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  /** Editar tipo en catálogo o membresía de pack. */
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
      action: PERMISSION_ACTION.UPDATE,
    },
    {
      resource: PERMISSION_RESOURCE.ACCREDITATION_PACKS,
      action: PERMISSION_ACTION.UPDATE,
    },
  ]),
  validate(updateDocumentTypeRequestSchema),
  updateDocumentTypeHandler,
);

documentTypesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteDocumentTypeRequestSchema),
  deleteDocumentTypeHandler,
);
