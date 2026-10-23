import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createAreaHandler,
  deleteAreaHandler,
  getAreaHandler,
  listAreasHandler,
  updateAreaHandler,
} from "./areas.controller.js";
import {
  createAreaRequestSchema,
  deleteAreaRequestSchema,
  getAreaRequestSchema,
  listAreasRequestSchema,
  updateAreaRequestSchema,
} from "./areas.schemas.js";

/**
 * Rutas de áreas bajo /api/v1/areas.
 * Express 5: handlers async directo.
 */
export const areasRouter = Router();

areasRouter.get(
  "/",
  authenticate,
  validate(listAreasRequestSchema),
  listAreasHandler,
);

areasRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createAreaRequestSchema),
  createAreaHandler,
);

areasRouter.get(
  "/:id",
  authenticate,
  validate(getAreaRequestSchema),
  getAreaHandler,
);

areasRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateAreaRequestSchema),
  updateAreaHandler,
);

areasRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteAreaRequestSchema),
  deleteAreaHandler,
);
