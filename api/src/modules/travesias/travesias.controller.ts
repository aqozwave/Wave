import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createTravesiaResponseSchema,
  deleteTravesiaResponseSchema,
  getTravesiaResponseSchema,
  listTravesiasResponseSchema,
  updateTravesiaResponseSchema,
  type CreateTravesiaBody,
  type ListTravesiasQuery,
  type UpdateTravesiaBody,
} from "./travesias.schemas.js";
import {
  createTravesia,
  deleteTravesiaById,
  getTravesiaById,
  listTravesias,
  updateTravesia,
} from "./travesias.service.js";

/** GET /travesias — listado scoped por tenant. */
export async function listTravesiasHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListTravesiasQuery;
  const result = await listTravesias(req.user, query);
  res.status(200).json(listTravesiasResponseSchema.parse(result));
}

/** POST /travesias — alta (admin o superadmin). */
export async function createTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateTravesiaBody;
  const created = await createTravesia(req.user, body);
  res.status(201).json(createTravesiaResponseSchema.parse(created));
}

/** GET /travesias/:id — detalle. */
export async function getTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getTravesiaById(req.user, id);
  res.status(200).json(getTravesiaResponseSchema.parse(item));
}

/** PATCH /travesias/:id — edición. */
export async function updateTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateTravesiaBody;
  const updated = await updateTravesia(req.user, id, body);
  res.status(200).json(updateTravesiaResponseSchema.parse(updated));
}

/** DELETE /travesias/:id — soft delete. */
export async function deleteTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteTravesiaById(req.user, id);
  res.status(200).json(deleteTravesiaResponseSchema.parse(deleted));
}
