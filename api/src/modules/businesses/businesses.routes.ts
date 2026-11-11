import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireModuleFromParams } from "../../middlewares/requireModule.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createBusinessHandler,
  deleteBusinessHandler,
  getBusinessHandler,
  listBusinessesHandler,
  listBusinessModulesHandler,
  patchBusinessModuleHandler,
  pingBusinessModuleHandler,
  updateBusinessHandler,
} from "./businesses.controller.js";
import {
  createBusinessRequestSchema,
  deleteBusinessRequestSchema,
  getBusinessRequestSchema,
  listBusinessesRequestSchema,
  listBusinessModulesRequestSchema,
  patchBusinessModuleRequestSchema,
  pingBusinessModuleRequestSchema,
  updateBusinessRequestSchema,
} from "./businesses.schemas.js";

/**
 * Rutas de empresas bajo /api/v1/businesses.
 * Express 5: handlers async se pasan directo (rejects → errorHandler).
 */
export const businessesRouter = Router();

// Listado: cualquier autenticado; el service filtra por tenant.
businessesRouter.get(
  "/",
  authenticate,
  validate(listBusinessesRequestSchema),
  listBusinessesHandler,
);

// Alta: permiso create sobre maestros.businesses.
businessesRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_BUSINESSES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createBusinessRequestSchema),
  createBusinessHandler,
);

/**
 * S6: listar interruptores Prevención (superadmin).
 * Antes de /:id/modules/:key y de /:id.
 */
businessesRouter.get(
  "/:id/modules",
  authenticate,
  requireSuperadmin,
  validate(listBusinessModulesRequestSchema),
  listBusinessModulesHandler,
);

/**
 * S6: prender/apagar submódulo (superadmin). Sin requireModule (puede estar off).
 */
businessesRouter.patch(
  "/:id/modules/:key",
  authenticate,
  requireSuperadmin,
  validate(patchBusinessModuleRequestSchema),
  patchBusinessModuleHandler,
);

/**
 * Sonda P0: 200 si el submódulo está on; 403 MODULE_DISABLED si no.
 */
businessesRouter.get(
  "/:id/modules/:key",
  authenticate,
  validate(pingBusinessModuleRequestSchema),
  requireModuleFromParams("id", "key"),
  pingBusinessModuleHandler,
);

// Detalle por id.
businessesRouter.get(
  "/:id",
  authenticate,
  validate(getBusinessRequestSchema),
  getBusinessHandler,
);

// Edición: permiso update sobre maestros.businesses.
businessesRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_BUSINESSES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateBusinessRequestSchema),
  updateBusinessHandler,
);

// Soft delete: permiso deactivate sobre maestros.businesses.
businessesRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_BUSINESSES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteBusinessRequestSchema),
  deleteBusinessHandler,
);
