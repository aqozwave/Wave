import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
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
 */
export const ranksRouter = Router();

ranksRouter.get(
  "/",
  authenticate,
  validate(listRanksRequestSchema),
  listRanksHandler,
);

ranksRouter.post(
  "/",
  authenticate,
  requireTenantManager,
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
