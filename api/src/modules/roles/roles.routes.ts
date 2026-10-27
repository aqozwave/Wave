import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
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
  updateRoleRequestSchema,
} from "./roles.schemas.js";

/**
 * Rutas de roles bajo /api/v1/roles.
 * Listado: admin o superadmin (selector usuarios).
 * Catálogo + CRUD: solo superadmin.
 */
export const rolesRouter = Router();

rolesRouter.use(authenticate);

rolesRouter.get(
  "/",
  requireTenantManager,
  validate(listRolesRequestSchema),
  listRolesHandler,
);

rolesRouter.use(requireSuperadmin);

rolesRouter.get("/catalog", getPermissionCatalogHandler);

rolesRouter.get(
  "/:id",
  validate(getRoleRequestSchema),
  getRoleHandler,
);

rolesRouter.post(
  "/",
  validate(createRoleRequestSchema),
  createRoleHandler,
);

rolesRouter.patch(
  "/:id",
  validate(updateRoleRequestSchema),
  updateRoleHandler,
);

rolesRouter.delete(
  "/:id",
  validate(deleteRoleRequestSchema),
  deleteRoleHandler,
);
