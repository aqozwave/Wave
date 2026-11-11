import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createLocationHandler,
  deleteLocationHandler,
  getLocationHandler,
  getLocationVesselPositionHandler,
  getMyVesselPositionHandler,
  listLocationsHandler,
  listVesselPositionsHandler,
  reportMyVesselPositionHandler,
  updateLocationHandler,
} from "./locations.controller.js";
import {
  createLocationRequestSchema,
  deleteLocationRequestSchema,
  getLocationPositionRequestSchema,
  getLocationRequestSchema,
  getMyVesselPositionRequestSchema,
  listLocationsRequestSchema,
  listVesselPositionsRequestSchema,
  reportVesselPositionRequestSchema,
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

// Posición de la nave del usuario (antes de /:id para no capturar "me").
locationsRouter.get(
  "/me/position",
  authenticate,
  validate(getMyVesselPositionRequestSchema),
  getMyVesselPositionHandler,
);
locationsRouter.post(
  "/me/position",
  authenticate,
  validate(reportVesselPositionRequestSchema),
  reportMyVesselPositionHandler,
);

// Flota: última señal por nave (antes de /:id).
locationsRouter.get(
  "/positions",
  authenticate,
  validate(listVesselPositionsRequestSchema),
  listVesselPositionsHandler,
);

// Última posición de una ubicación concreta.
locationsRouter.get(
  "/:id/position",
  authenticate,
  validate(getLocationPositionRequestSchema),
  getLocationVesselPositionHandler,
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
