import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createLocationResponseSchema,
  deleteLocationResponseSchema,
  getLocationResponseSchema,
  getVesselPositionResponseSchema,
  listLocationsResponseSchema,
  listVesselPositionsResponseSchema,
  reportVesselPositionResponseSchema,
  updateLocationResponseSchema,
  type CreateLocationBody,
  type ListLocationsQuery,
  type ListVesselPositionsQuery,
  type ReportVesselPositionBody,
  type UpdateLocationBody,
} from "./locations.schemas.js";
import {
  createLocation,
  deleteLocationById,
  getLocationById,
  getLocationVesselPosition,
  getMyVesselPosition,
  listLatestVesselPositions,
  listLocations,
  reportMyVesselPosition,
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
  auditWrite(req, {
    action: "CREATE",
    resource: "location",
    resourceId: created.id,
    targetLabel: created.name,
  });
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
  auditWrite(req, {
    action: "UPDATE",
    resource: "location",
    resourceId: updated.id,
    targetLabel: updated.name,
    metadata: { fields: safeChangedFields(body) },
  });
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
  auditWrite(req, {
    action: "DELETE",
    resource: "location",
    resourceId: deleted.id,
    targetLabel: deleted.name,
  });
  const out = deleteLocationResponseSchema.parse(deleted);
  res.status(200).json(out);
}

/**
 * POST /locations/me/position — guarda lat/lng del navegador en la nave del usuario.
 */
export async function reportMyVesselPositionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const body = req.body as ReportVesselPositionBody;
  const created = await reportMyVesselPosition(req.user, body);
  const out = reportVesselPositionResponseSchema.parse(created);
  res.status(201).json(out);
}

/**
 * GET /locations/me/position — última posición de la nave del usuario.
 */
export async function getMyVesselPositionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const item = await getMyVesselPosition(req.user);
  const body = getVesselPositionResponseSchema.parse(item);
  res.status(200).json(body);
}

/**
 * GET /locations/:id/position — última posición de una ubicación (tenant).
 */
export async function getLocationVesselPositionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const item = await getLocationVesselPosition(req.user, id);
  const body = getVesselPositionResponseSchema.parse(item);
  res.status(200).json(body);
}

/**
 * GET /locations/positions — última señal por nave (mapa flota del admin).
 */
export async function listVesselPositionsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const query = req.query as unknown as ListVesselPositionsQuery;
  const result = await listLatestVesselPositions(req.user, query);
  const body = listVesselPositionsResponseSchema.parse(result);
  res.status(200).json(body);
}
