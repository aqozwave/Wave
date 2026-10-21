import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createBusinessResponseSchema,
  listBusinessesResponseSchema,
  type CreateBusinessBody,
  type ListBusinessesQuery,
} from "./businesses.schemas.js";
import { createBusiness, listBusinesses } from "./businesses.service.js";

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
