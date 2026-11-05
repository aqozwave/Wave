import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createContractorHandler,
  createContractorPersonHandler,
  deleteContractorHandler,
  deleteContractorPersonHandler,
  getContractorHandler,
  getContractorPortalSummaryHandler,
  inviteContractorUserHandler,
  listContractorPeopleHandler,
  listContractorUsersHandler,
  listContractorsHandler,
  updateContractorHandler,
  updateContractorPersonHandler,
} from "./contractors.controller.js";
import {
  createContractorPersonRequestSchema,
  createContractorRequestSchema,
  deleteContractorPersonRequestSchema,
  deleteContractorRequestSchema,
  getContractorPortalSummaryRequestSchema,
  getContractorRequestSchema,
  inviteContractorUserRequestSchema,
  listContractorPeopleRequestSchema,
  listContractorUsersRequestSchema,
  listContractorsRequestSchema,
  updateContractorPersonRequestSchema,
  updateContractorRequestSchema,
} from "./contractors.schemas.js";

/**
 * Organizaciones contratistas bajo /api/v1/contractors (P2).
 * Lectura: contractors.read. Mutaciones: admin/superadmin + create/update/deactivate.
 * Módulo contractors on se valida en el service (por businessId de la org).
 */
export const contractorsRouter = Router();

/** Portal E*: usuario externo (organizationId). Sin requirePermission. */
contractorsRouter.get(
  "/me/summary",
  authenticate,
  validate(getContractorPortalSummaryRequestSchema),
  getContractorPortalSummaryHandler,
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
