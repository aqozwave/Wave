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

/** Rutas de empresas bajo /api/v1/businesses. */
export const businessesRouter = Router();

// Listado: cualquier autenticado; el service filtra por tenant.
businessesRouter.get(
  "/",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  validate(listBusinessesRequestSchema),
  (req, res, next) => {
    listBusinessesHandler(req, res).catch(next);
  },
);

// Alta: solo superadmin (opción A).
businessesRouter.post(
  "/",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  requireSuperadmin,
  validate(createBusinessRequestSchema),
  (req, res, next) => {
    createBusinessHandler(req, res).catch(next);
  },
);

// Detalle por id.
businessesRouter.get(
  "/:id",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  validate(getBusinessRequestSchema),
  (req, res, next) => {
    getBusinessHandler(req, res).catch(next);
  },
);

// Edición: autenticado; service aplica opción A (admin vs superadmin).
businessesRouter.patch(
  "/:id",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  validate(updateBusinessRequestSchema),
  (req, res, next) => {
    updateBusinessHandler(req, res).catch(next);
  },
);

// Soft delete: solo superadmin.
businessesRouter.delete(
  "/:id",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  requireSuperadmin,
  validate(deleteBusinessRequestSchema),
  (req, res, next) => {
    deleteBusinessHandler(req, res).catch(next);
  },
);
