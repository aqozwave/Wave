import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createBusinessHandler,
  listBusinessesHandler,
} from "./businesses.controller.js";
import {
  createBusinessRequestSchema,
  listBusinessesRequestSchema,
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
