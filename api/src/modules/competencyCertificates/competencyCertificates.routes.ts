import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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
 * Lectura: permiso maestros.certificates read.
 * Alta/edición/baja: admin/superadmin + permiso create/update/deactivate
 * (incluye el check “Exige muelles y travesías”).
 */
export const competencyCertificatesRouter = Router();

competencyCertificatesRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.READ,
  ),
  validate(listCompetencyCertificatesRequestSchema),
  listCompetencyCertificatesHandler,
);

competencyCertificatesRouter.post(
  "/",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createCompetencyCertificateRequestSchema),
  createCompetencyCertificateHandler,
);

competencyCertificatesRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.READ,
  ),
  validate(getCompetencyCertificateRequestSchema),
  getCompetencyCertificateHandler,
);

competencyCertificatesRouter.patch(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateCompetencyCertificateRequestSchema),
  updateCompetencyCertificateHandler,
);

competencyCertificatesRouter.delete(
  "/:id",
  authenticate,
  requireTenantManager,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCompetencyCertificateRequestSchema),
  deleteCompetencyCertificateHandler,
);
