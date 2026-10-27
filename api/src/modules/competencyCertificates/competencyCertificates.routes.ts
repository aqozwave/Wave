import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCompetencyCertificateHandler,
  deleteCompetencyCertificateHandler,
  getCompetencyCertificateHandler,
  listCompetencyCertificatesHandler,
  updateCompetencyCertificateHandler,
} from "./competencyCertificates.controller.js";
import {
  createCompetencyCertificateRequestSchema,
  deleteCompetencyCertificateRequestSchema,
  getCompetencyCertificateRequestSchema,
  listCompetencyCertificatesRequestSchema,
  updateCompetencyCertificateRequestSchema,
} from "./competencyCertificates.schemas.js";

/**
 * Rutas de certificados bajo /api/v1/competency-certificates.
 * Express 5: handlers async directo.
 */
export const competencyCertificatesRouter = Router();

competencyCertificatesRouter.get(
  "/",
  authenticate,
  validate(listCompetencyCertificatesRequestSchema),
  listCompetencyCertificatesHandler,
);

competencyCertificatesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  validate(createCompetencyCertificateRequestSchema),
  createCompetencyCertificateHandler,
);

competencyCertificatesRouter.get(
  "/:id",
  authenticate,
  validate(getCompetencyCertificateRequestSchema),
  getCompetencyCertificateHandler,
);

competencyCertificatesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(updateCompetencyCertificateRequestSchema),
  updateCompetencyCertificateHandler,
);

competencyCertificatesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  validate(deleteCompetencyCertificateRequestSchema),
  deleteCompetencyCertificateHandler,
);
