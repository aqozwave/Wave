import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createTravesiaHandler,
  deleteTravesiaHandler,
  getTravesiaHandler,
  listTravesiasHandler,
  updateTravesiaHandler,
} from "./travesias.controller.js";
import {
  createTravesiaRequestSchema,
  deleteTravesiaRequestSchema,
  getTravesiaRequestSchema,
  listTravesiasRequestSchema,
  updateTravesiaRequestSchema,
} from "./travesias.schemas.js";

/**
 * Rutas de travesías bajo /api/v1/travesias.
 * Express 5: handlers async directo.
 */
export const travesiasRouter = Router();

travesiasRouter.get(
  "/",
  authenticate,
  validate(listTravesiasRequestSchema),
  listTravesiasHandler,
);

travesiasRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createTravesiaRequestSchema),
  createTravesiaHandler,
);

travesiasRouter.get(
  "/:id",
  authenticate,
  validate(getTravesiaRequestSchema),
  getTravesiaHandler,
);

travesiasRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateTravesiaRequestSchema),
  updateTravesiaHandler,
);

travesiasRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteTravesiaRequestSchema),
  deleteTravesiaHandler,
);
