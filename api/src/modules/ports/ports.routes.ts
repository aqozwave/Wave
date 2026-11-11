import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_PORTS,
    PERMISSION_ACTION.CREATE,
  ),
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
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_PORTS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updatePortRequestSchema),
  updatePortHandler,
);

portsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_PORTS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deletePortRequestSchema),
  deletePortHandler,
);
