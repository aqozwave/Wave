import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createPortHandler,
  deletePortHandler,
  getPortHandler,
  listPortsHandler,
  updatePortHandler,
} from "./ports.controller.js";
import {
  createPortRequestSchema,
  deletePortRequestSchema,
  getPortRequestSchema,
  listPortsRequestSchema,
  updatePortRequestSchema,
} from "./ports.schemas.js";

/**
 * Rutas de puertos bajo /api/v1/ports.
 * Express 5: handlers async directo.
 */
export const portsRouter = Router();

portsRouter.get(
  "/",
  authenticate,
  validate(listPortsRequestSchema),
  listPortsHandler,
);

portsRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createPortRequestSchema),
  createPortHandler,
);

portsRouter.get(
  "/:id",
  authenticate,
  validate(getPortRequestSchema),
  getPortHandler,
);

portsRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updatePortRequestSchema),
  updatePortHandler,
);

portsRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deletePortRequestSchema),
  deletePortHandler,
);
