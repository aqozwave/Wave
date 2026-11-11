import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createPermitChecklistItemHandler,
  createPermitTypeHandler,
  createPermitTypeRequirementHandler,
  deletePermitChecklistItemHandler,
  deletePermitTypeHandler,
  deletePermitTypeRequirementHandler,
  getPermitTypeHandler,
  listPermitChecklistItemsHandler,
  listPermitTypeRequirementsHandler,
  listPermitTypesHandler,
  updatePermitChecklistItemHandler,
  updatePermitTypeHandler,
  updatePermitTypeRequirementHandler,
} from "./permitTypes.controller.js";
import {
  createPermitChecklistItemRequestSchema,
  createPermitTypeRequestSchema,
  createPermitTypeRequirementRequestSchema,
  deletePermitChecklistItemRequestSchema,
  deletePermitTypeRequestSchema,
  deletePermitTypeRequirementRequestSchema,
  getPermitTypeRequestSchema,
  listPermitChecklistItemsRequestSchema,
  listPermitTypeRequirementsRequestSchema,
  listPermitTypesRequestSchema,
  updatePermitChecklistItemRequestSchema,
  updatePermitTypeRequestSchema,
  updatePermitTypeRequirementRequestSchema,
} from "./permitTypes.schemas.js";

/**
 * Catálogo tipos de permiso bajo /api/v1/permit-types.
 * Lectura: permit_types.read. Mutaciones: requirePermission (create/update/deactivate); superadmin bypass.
 * Nested: requirements y checklist-items (mismas reglas).
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
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createPermitTypeRequestSchema),
  createPermitTypeHandler,
);

/** Nested requirements — antes de /:id plano. */
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

permitTypesRouter.post(
  "/:id/requirements",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createPermitTypeRequirementRequestSchema),
  createPermitTypeRequirementHandler,
);

permitTypesRouter.patch(
  "/:id/requirements/:requirementId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updatePermitTypeRequirementRequestSchema),
  updatePermitTypeRequirementHandler,
);

permitTypesRouter.delete(
  "/:id/requirements/:requirementId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deletePermitTypeRequirementRequestSchema),
  deletePermitTypeRequirementHandler,
);

/** Nested checklist — antes de /:id plano. */
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

permitTypesRouter.post(
  "/:id/checklist-items",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createPermitChecklistItemRequestSchema),
  createPermitChecklistItemHandler,
);

permitTypesRouter.patch(
  "/:id/checklist-items/:itemId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updatePermitChecklistItemRequestSchema),
  updatePermitChecklistItemHandler,
);

permitTypesRouter.delete(
  "/:id/checklist-items/:itemId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deletePermitChecklistItemRequestSchema),
  deletePermitChecklistItemHandler,
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
  requirePermission(
    PERMISSION_RESOURCE.PERMIT_TYPES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deletePermitTypeRequestSchema),
  deletePermitTypeHandler,
);
