import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createRoleHandler,
  deleteRoleHandler,
  getPermissionCatalogHandler,
  getRoleHandler,
  listRolesHandler,
  updateRoleHandler,
} from "./roles.controller.js";
import {
  createRoleRequestSchema,
  deleteRoleRequestSchema,
  getRoleRequestSchema,
  listRolesRequestSchema,
  permissionCatalogRequestSchema,
  updateRoleRequestSchema,
} from "./roles.schemas.js";

/**
 * Rutas de roles bajo /api/v1/roles.
 * Listado: roles:read o quien invita/edita usuarios (selector).
 * Catálogo + detalle + CRUD: roles.*.
 */
export const rolesRouter = Router();

rolesRouter.use(authenticate);

rolesRouter.get(
  "/",
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.ROLES,
      action: PERMISSION_ACTION.READ,
    },
    {
      resource: PERMISSION_RESOURCE.MAESTROS_USERS,
      action: PERMISSION_ACTION.CREATE,
    },
    {
      resource: PERMISSION_RESOURCE.MAESTROS_USERS,
      action: PERMISSION_ACTION.UPDATE,
    },
  ]),
  validate(listRolesRequestSchema),
  listRolesHandler,
);

rolesRouter.get(
  "/catalog",
  requirePermission(PERMISSION_RESOURCE.ROLES, PERMISSION_ACTION.READ),
  validate(permissionCatalogRequestSchema),
  getPermissionCatalogHandler,
);

rolesRouter.get(
  "/:id",
  requirePermission(PERMISSION_RESOURCE.ROLES, PERMISSION_ACTION.READ),
  validate(getRoleRequestSchema),
  getRoleHandler,
);

rolesRouter.post(
  "/",
  requirePermission(PERMISSION_RESOURCE.ROLES, PERMISSION_ACTION.CREATE),
  validate(createRoleRequestSchema),
  createRoleHandler,
);

rolesRouter.patch(
  "/:id",
  requirePermission(PERMISSION_RESOURCE.ROLES, PERMISSION_ACTION.UPDATE),
  validate(updateRoleRequestSchema),
  updateRoleHandler,
);

rolesRouter.delete(
  "/:id",
  requirePermission(PERMISSION_RESOURCE.ROLES, PERMISSION_ACTION.DEACTIVATE),
  validate(deleteRoleRequestSchema),
  deleteRoleHandler,
);
