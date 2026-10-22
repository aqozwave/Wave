import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createBusinessHandler,
  deleteBusinessHandler,
  getBusinessHandler,
  listBusinessesHandler,
  updateBusinessHandler,
} from "./businesses.controller.js";
import {
  createBusinessRequestSchema,
  deleteBusinessRequestSchema,
  getBusinessRequestSchema,
  listBusinessesRequestSchema,
  updateBusinessRequestSchema,
} from "./businesses.schemas.js";

/**
 * Rutas de empresas bajo /api/v1/businesses.
 * Express 5: handlers async se pasan directo (rejects → errorHandler).
 */
export const businessesRouter = Router();

// Listado: cualquier autenticado; el service filtra por tenant.
businessesRouter.get(
  "/",
  authenticate,
  validate(listBusinessesRequestSchema),
  listBusinessesHandler,
);

// Alta: solo superadmin (opción A).
businessesRouter.post(
  "/",
  authenticate,
  requireSuperadmin,
  validate(createBusinessRequestSchema),
  createBusinessHandler,
);

// Detalle por id.
businessesRouter.get(
  "/:id",
  authenticate,
  validate(getBusinessRequestSchema),
  getBusinessHandler,
);

// Edición: autenticado; service aplica opción A (admin vs superadmin).
businessesRouter.patch(
  "/:id",
  authenticate,
  validate(updateBusinessRequestSchema),
  updateBusinessHandler,
);

// Soft delete: solo superadmin.
businessesRouter.delete(
  "/:id",
  authenticate,
  requireSuperadmin,
  validate(deleteBusinessRequestSchema),
  deleteBusinessHandler,
);
