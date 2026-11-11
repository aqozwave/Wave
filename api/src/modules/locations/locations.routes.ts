import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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

// Alta: permiso create sobre maestros.locations.
locationsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_LOCATIONS,
    PERMISSION_ACTION.CREATE,
  ),
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

// Edición: permiso update sobre maestros.locations.
locationsRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_LOCATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateLocationRequestSchema),
  updateLocationHandler,
);

// Soft delete: permiso deactivate sobre maestros.locations.
locationsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_LOCATIONS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteLocationRequestSchema),
  deleteLocationHandler,
);
