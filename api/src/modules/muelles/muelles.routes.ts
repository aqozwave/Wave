import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createMuelleHandler,
  deleteMuelleHandler,
  getMuelleHandler,
  listMuellesHandler,
  updateMuelleHandler,
} from "./muelles.controller.js";
import {
  createMuelleRequestSchema,
  deleteMuelleRequestSchema,
  getMuelleRequestSchema,
  listMuellesRequestSchema,
  updateMuelleRequestSchema,
} from "./muelles.schemas.js";

/**
 * Rutas de muelles bajo /api/v1/muelles.
 * Express 5: handlers async directo.
 */
export const muellesRouter = Router();

muellesRouter.get(
  "/",
  authenticate,
  validate(listMuellesRequestSchema),
  listMuellesHandler,
);

muellesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createMuelleRequestSchema),
  createMuelleHandler,
);

muellesRouter.get(
  "/:id",
  authenticate,
  validate(getMuelleRequestSchema),
  getMuelleHandler,
);

muellesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateMuelleRequestSchema),
  updateMuelleHandler,
);

muellesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteMuelleRequestSchema),
  deleteMuelleHandler,
);
