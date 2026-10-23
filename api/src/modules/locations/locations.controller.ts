import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createLocationResponseSchema,
  deleteLocationResponseSchema,
  getLocationResponseSchema,
  listLocationsResponseSchema,
  updateLocationResponseSchema,
  type CreateLocationBody,
  type ListLocationsQuery,
  type UpdateLocationBody,
} from "./locations.schemas.js";
import {
  createLocation,
  deleteLocationById,
  getLocationById,
  listLocations,
  updateLocation,
} from "./locations.service.js";

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

/**
 * GET /locations/:id — detalle con acceso tenant.
 */
export async function getLocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const item = await getLocationById(req.user, id);
  const body = getLocationResponseSchema.parse(item);
  res.status(200).json(body);
}

/**
 * PATCH /locations/:id — edición (admin o superadmin).
 */
export async function updateLocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const body = req.body as UpdateLocationBody;
  const updated = await updateLocation(req.user, id, body);
  const out = updateLocationResponseSchema.parse(updated);
  res.status(200).json(out);
}

/**
 * DELETE /locations/:id — soft delete (admin o superadmin).
 */
export async function deleteLocationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const deleted = await deleteLocationById(req.user, id);
  const out = deleteLocationResponseSchema.parse(deleted);
  res.status(200).json(out);
}
