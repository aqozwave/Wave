import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createCompetencyCertificateResponseSchema,
  deleteCompetencyCertificateResponseSchema,
  getCompetencyCertificateResponseSchema,
  listCompetencyCertificatesResponseSchema,
  updateCompetencyCertificateResponseSchema,
  type CreateCompetencyCertificateBody,
  type ListCompetencyCertificatesQuery,
  type UpdateCompetencyCertificateBody,
} from "./competencyCertificates.schemas.js";
import {
  createCompetencyCertificate,
  deleteCompetencyCertificateById,
  getCompetencyCertificateById,
  listCompetencyCertificates,
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
  res
    .status(200)
    .json(deleteCompetencyCertificateResponseSchema.parse(deleted));
}
