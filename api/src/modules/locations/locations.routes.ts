import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createLocationHandler,
  listLocationsHandler,
} from "./locations.controller.js";
import {
  createLocationRequestSchema,
  listLocationsRequestSchema,
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

// Alta: admin o superadmin (portal viejo requireTenantManager).
locationsRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createLocationRequestSchema),
  createLocationHandler,
);
