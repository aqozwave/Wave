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

/** Rutas de ubicaciones bajo /api/v1/locations. */
export const locationsRouter = Router();

// Listado: cualquier autenticado; el service filtra por tenant.
locationsRouter.get(
  "/",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  validate(listLocationsRequestSchema),
  (req, res, next) => {
    listLocationsHandler(req, res).catch(next);
  },
);

// Alta: admin o superadmin (portal viejo requireTenantManager).
locationsRouter.post(
  "/",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  requireTenantManager,
  validate(createLocationRequestSchema),
  (req, res, next) => {
    createLocationHandler(req, res).catch(next);
  },
);
