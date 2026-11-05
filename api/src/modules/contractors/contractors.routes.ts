import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createContractorHandler,
  deleteContractorHandler,
  getContractorHandler,
  inviteContractorUserHandler,
  listContractorUsersHandler,
  listContractorsHandler,
  updateContractorHandler,
} from "./contractors.controller.js";
import {
  createContractorRequestSchema,
  deleteContractorRequestSchema,
  getContractorRequestSchema,
  inviteContractorUserRequestSchema,
  listContractorUsersRequestSchema,
  listContractorsRequestSchema,
  updateContractorRequestSchema,
} from "./contractors.schemas.js";

/**
 * Organizaciones contratistas bajo /api/v1/contractors (P2).
 * Lectura: contractors.read. Mutaciones: admin/superadmin + create/update/deactivate.
 * Módulo contractors on se valida en el service (por businessId de la org).
 */
export const contractorsRouter = Router();

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
