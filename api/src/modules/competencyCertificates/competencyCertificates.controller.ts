import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createCompetencyCertificateResponseSchema,
  deleteCompetencyCertificateResponseSchema,
  getCompetencyCertificateResponseSchema,
  listCompetencyCertificateCoursesResponseSchema,
  listCompetencyCertificatesResponseSchema,
  replaceCompetencyCertificateCoursesResponseSchema,
  updateCompetencyCertificateResponseSchema,
  type CreateCompetencyCertificateBody,
  type ListCompetencyCertificatesQuery,
  type ReplaceCompetencyCertificateCoursesBody,
  type UpdateCompetencyCertificateBody,
} from "./competencyCertificates.schemas.js";
import {
  createCompetencyCertificate,
  deleteCompetencyCertificateById,
  getCompetencyCertificateById,
  listCompetencyCertificateCourses,
  listCompetencyCertificates,
  replaceCompetencyCertificateCourses,
  updateCompetencyCertificate,
} from "./competencyCertificates.service.js";

/** GET /competency-certificates — listado scoped por tenant. */
export async function listCompetencyCertificatesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListCompetencyCertificatesQuery;
  const result = await listCompetencyCertificates(req.user, query);
  res.status(200).json(listCompetencyCertificatesResponseSchema.parse(result));
}

/** POST /competency-certificates — alta (admin o superadmin). */
export async function createCompetencyCertificateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateCompetencyCertificateBody;
  const created = await createCompetencyCertificate(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "competencyCertificate",
    resourceId: created.id,
    targetLabel: created.name,
  });
  res
    .status(201)
    .json(createCompetencyCertificateResponseSchema.parse(created));
}

/** GET /competency-certificates/:id — detalle. */
export async function getCompetencyCertificateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getCompetencyCertificateById(req.user, id);
  res.status(200).json(getCompetencyCertificateResponseSchema.parse(item));
}

/** PATCH /competency-certificates/:id — edición. */
export async function updateCompetencyCertificateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateCompetencyCertificateBody;
  const updated = await updateCompetencyCertificate(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "competencyCertificate",
    resourceId: updated.id,
    targetLabel: updated.name,
    metadata: { fields: safeChangedFields(body) },
  });
  res
    .status(200)
    .json(updateCompetencyCertificateResponseSchema.parse(updated));
}

/** DELETE /competency-certificates/:id — soft delete. */
export async function deleteCompetencyCertificateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteCompetencyCertificateById(req.user, id);
  auditWrite(req, {
    action: "DELETE",
    resource: "competencyCertificate",
    resourceId: deleted.id,
    targetLabel: deleted.name,
  });
  res
    .status(200)
    .json(deleteCompetencyCertificateResponseSchema.parse(deleted));
}

/** GET /competency-certificates/:id/courses — cursos del título. */
export async function listCompetencyCertificateCoursesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await listCompetencyCertificateCourses(req.user, id);
  res
    .status(200)
    .json(listCompetencyCertificateCoursesResponseSchema.parse(result));
}

/**
 * PUT /competency-certificates/:id/courses — reemplaza el set de cursos
 * y synca altas a tripulantes con ese título.
 */
export async function replaceCompetencyCertificateCoursesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as ReplaceCompetencyCertificateCoursesBody;
  const result = await replaceCompetencyCertificateCourses(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "competencyCertificate",
    resourceId: id,
    targetLabel: "cursos del título",
    metadata: {
      courseCount: result.assignments.length,
      sync: result.sync,
    },
  });
  res
    .status(200)
    .json(replaceCompetencyCertificateCoursesResponseSchema.parse(result));
}
