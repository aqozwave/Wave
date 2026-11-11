import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createCompetencyCertificateHandler,
  deleteCompetencyCertificateHandler,
  getCompetencyCertificateHandler,
  listCompetencyCertificateCoursesHandler,
  listCompetencyCertificatesHandler,
  replaceCompetencyCertificateCoursesHandler,
  updateCompetencyCertificateHandler,
} from "./competencyCertificates.controller.js";
import {
  createCompetencyCertificateRequestSchema,
  deleteCompetencyCertificateRequestSchema,
  getCompetencyCertificateRequestSchema,
  listCompetencyCertificateCoursesRequestSchema,
  listCompetencyCertificatesRequestSchema,
  replaceCompetencyCertificateCoursesRequestSchema,
  updateCompetencyCertificateRequestSchema,
} from "./competencyCertificates.schemas.js";

/**
 * Rutas de certificados bajo /api/v1/competency-certificates.
 * Lectura: permiso maestros.certificates read.
 * Alta/edición/baja: requirePermission create/update/deactivate (superadmin bypass)
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
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createCompetencyCertificateRequestSchema),
  createCompetencyCertificateHandler,
);

/**
 * Cursos del título: rutas anidadas antes de PATCH/DELETE del :id
 * (mismo param; path más específico).
 */
competencyCertificatesRouter.get(
  "/:id/courses",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.READ,
  ),
  validate(listCompetencyCertificateCoursesRequestSchema),
  listCompetencyCertificateCoursesHandler,
);

competencyCertificatesRouter.put(
  "/:id/courses",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(replaceCompetencyCertificateCoursesRequestSchema),
  replaceCompetencyCertificateCoursesHandler,
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
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteCompetencyCertificateRequestSchema),
  deleteCompetencyCertificateHandler,
);
