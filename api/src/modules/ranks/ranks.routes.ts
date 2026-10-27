import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createRankHandler,
  deleteRankHandler,
  getRankHandler,
  listRanksHandler,
  updateRankHandler,
} from "./ranks.controller.js";
import {
  createRankRequestSchema,
  deleteRankRequestSchema,
  getRankRequestSchema,
  listRanksRequestSchema,
  updateRankRequestSchema,
} from "./ranks.schemas.js";

/**
 * Rutas de rangos / cargos bajo /api/v1/ranks.
 * Express 5: handlers async directo.
 * requirePermission: prueba S6 (superadmin bypass; resto usa Role.permissions).
 */
export const ranksRouter = Router();

ranksRouter.get(
  "/",
  authenticate,
  requirePermission(PERMISSION_RESOURCE.MAESTROS_RANKS, PERMISSION_ACTION.READ),
  validate(listRanksRequestSchema),
  listRanksHandler,
);

ranksRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_RANKS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createRankRequestSchema),
  createRankHandler,
);

ranksRouter.get(
  "/:id",
  authenticate,
  validate(getRankRequestSchema),
  getRankHandler,
);

ranksRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateRankRequestSchema),
  updateRankHandler,
);

ranksRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteRankRequestSchema),
  deleteRankHandler,
);
