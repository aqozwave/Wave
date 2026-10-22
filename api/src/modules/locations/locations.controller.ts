import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createLocationResponseSchema,
  listLocationsResponseSchema,
  type CreateLocationBody,
  type ListLocationsQuery,
} from "./locations.schemas.js";
import { createLocation, listLocations } from "./locations.service.js";

/**
 * GET /locations — listado scoped por tenant.
 */
export async function listLocationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const query = req.query as unknown as ListLocationsQuery;
  const result = await listLocations(req.user, query);
  const body = listLocationsResponseSchema.parse(result);
  res.status(200).json(body);
}

/**
 * POST /locations — alta (admin o superadmin en la ruta).
 */
export async function createLocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const body = req.body as CreateLocationBody;
  const created = await createLocation(req.user, body);
  const out = createLocationResponseSchema.parse(created);
  res.status(201).json(out);
}
