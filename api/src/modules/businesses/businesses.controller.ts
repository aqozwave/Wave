import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createBusinessResponseSchema,
  deleteBusinessResponseSchema,
  getBusinessResponseSchema,
  listBusinessesResponseSchema,
  updateBusinessResponseSchema,
  type CreateBusinessBody,
  type ListBusinessesQuery,
  type UpdateBusinessBody,
} from "./businesses.schemas.js";
import {
  createBusiness,
  deleteBusinessById,
  getBusinessById,
  listBusinesses,
  updateBusiness,
} from "./businesses.service.js";

/**
 * GET /businesses — listado scoped por tenant.
 * Exige `authenticate` antes.
 */
export async function listBusinessesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const query = req.query as unknown as ListBusinessesQuery;
  const result = await listBusinesses(req.user, query);
  const body = listBusinessesResponseSchema.parse(result);
  res.status(200).json(body);
}

/**
 * POST /businesses — alta (solo superadmin en la ruta).
 */
export async function createBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateBusinessBody;
  const created = await createBusiness(body);
  const out = createBusinessResponseSchema.parse(created);
  res.status(201).json(out);
}

/**
 * GET /businesses/:id — detalle con acceso tenant.
 */
export async function getBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const item = await getBusinessById(req.user, id);
  const body = getBusinessResponseSchema.parse(item);
  res.status(200).json(body);
}

/**
 * PATCH /businesses/:id — edición (superadmin todo; admin contacto).
 */
export async function updateBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const body = req.body as UpdateBusinessBody;
  const updated = await updateBusiness(req.user, id, body);
  const out = updateBusinessResponseSchema.parse(updated);
  res.status(200).json(out);
}

/**
 * DELETE /businesses/:id — soft delete (solo superadmin en la ruta).
 */
export async function deleteBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const deleted = await deleteBusinessById(id);
  const out = deleteBusinessResponseSchema.parse(deleted);
  res.status(200).json(out);
}
