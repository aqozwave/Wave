import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createAreaResponseSchema,
  deleteAreaResponseSchema,
  getAreaResponseSchema,
  listAreasResponseSchema,
  updateAreaResponseSchema,
  type CreateAreaBody,
  type ListAreasQuery,
  type UpdateAreaBody,
} from "./areas.schemas.js";
import {
  createArea,
  deleteAreaById,
  getAreaById,
  listAreas,
  updateArea,
} from "./areas.service.js";

/** GET /areas — listado scoped por tenant. */
export async function listAreasHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListAreasQuery;
  const result = await listAreas(req.user, query);
  res.status(200).json(listAreasResponseSchema.parse(result));
}

/** POST /areas — alta (admin o superadmin). */
export async function createAreaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateAreaBody;
  const created = await createArea(req.user, body);
  res.status(201).json(createAreaResponseSchema.parse(created));
}

/** GET /areas/:id — detalle. */
export async function getAreaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getAreaById(req.user, id);
  res.status(200).json(getAreaResponseSchema.parse(item));
}

/** PATCH /areas/:id — edición. */
export async function updateAreaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateAreaBody;
  const updated = await updateArea(req.user, id, body);
  res.status(200).json(updateAreaResponseSchema.parse(updated));
}

/** DELETE /areas/:id — soft delete. */
export async function deleteAreaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteAreaById(req.user, id);
  res.status(200).json(deleteAreaResponseSchema.parse(deleted));
}
