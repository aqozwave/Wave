import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createLocationHandler,
  deleteLocationHandler,
  getLocationHandler,
  listLocationsHandler,
  updateLocationHandler,
} from "./locations.controller.js";
import {
  createLocationRequestSchema,
  deleteLocationRequestSchema,
  getLocationRequestSchema,
  listLocationsRequestSchema,
  updateLocationRequestSchema,
} from "./locations.schemas.js";

/**
 * Rutas de ubicaciones bajo /api/v1/locations.
 * Express 5: handlers async se pasan directo (rejects → errorHandler).
 */
export const locationsRouter = Router();

// Listado: cualquier autenticado; el service filtra por tenant.
locationsRouter.get(
  "/",
  authenticate,
  validate(listLocationsRequestSchema),
  listLocationsHandler,
);

// Alta: admin o superadmin.
locationsRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createLocationRequestSchema),
  createLocationHandler,
);

// Detalle por id.
locationsRouter.get(
  "/:id",
  authenticate,
  validate(getLocationRequestSchema),
  getLocationHandler,
);

// Edición: admin o superadmin.
locationsRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateLocationRequestSchema),
  updateLocationHandler,
);

// Soft delete: admin o superadmin.
locationsRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteLocationRequestSchema),
  deleteLocationHandler,
);
