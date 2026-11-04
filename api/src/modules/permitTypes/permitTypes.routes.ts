import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createPermitTypeHandler,
  deletePermitTypeHandler,
  getPermitTypeHandler,
  listPermitChecklistItemsHandler,
  listPermitTypeRequirementsHandler,
  listPermitTypesHandler,
  updatePermitTypeHandler,
} from "./permitTypes.controller.js";
import {
  createPermitTypeRequestSchema,
  deletePermitTypeRequestSchema,
  getPermitTypeRequestSchema,
  listPermitChecklistItemsRequestSchema,
  listPermitTypeRequirementsRequestSchema,
  listPermitTypesRequestSchema,
  updatePermitTypeRequestSchema,
} from "./permitTypes.schemas.js";

/**
 * Catálogo tipos de permiso bajo /api/v1/permit-types.
 * Lectura: permit_types.read. Mutaciones: admin/superadmin + create/update/deactivate.
 */
export const permitTypesRouter = Router();

permitTypesRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.READ,
  ),
  validate(listPermitTypesRequestSchema),
  listPermitTypesHandler,
);

permitTypesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createPermitTypeRequestSchema),
  createPermitTypeHandler,
);

/** Antes de /:id para no confundir el path (Express matchea en orden). */
permitTypesRouter.get(
  "/:id/requirements",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.READ,
  ),
  validate(listPermitTypeRequirementsRequestSchema),
  listPermitTypeRequirementsHandler,
);

permitTypesRouter.get(
  "/:id/checklist-items",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.READ,
  ),
  validate(listPermitChecklistItemsRequestSchema),
  listPermitChecklistItemsHandler,
);

permitTypesRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.READ,
  ),
  validate(getPermitTypeRequestSchema),
  getPermitTypeHandler,
);

permitTypesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updatePermitTypeRequestSchema),
  updatePermitTypeHandler,
);

permitTypesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deletePermitTypeRequestSchema),
  deletePermitTypeHandler,
);
