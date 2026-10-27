import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createRankResponseSchema,
  deleteRankResponseSchema,
  getRankResponseSchema,
  listRanksResponseSchema,
  updateRankResponseSchema,
  type CreateRankBody,
  type ListRanksQuery,
  type UpdateRankBody,
} from "./ranks.schemas.js";
import {
  createRank,
  deleteRankById,
  getRankById,
  listRanks,
  updateRank,
} from "./ranks.service.js";

/** GET /ranks — listado scoped por tenant. */
export async function listRanksHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListRanksQuery;
  const result = await listRanks(req.user, query);
  res.status(200).json(listRanksResponseSchema.parse(result));
}

/** POST /ranks — alta (admin o superadmin). */
export async function createRankHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateRankBody;
  const created = await createRank(req.user, body);
  res.status(201).json(createRankResponseSchema.parse(created));
}

/** GET /ranks/:id — detalle. */
export async function getRankHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getRankById(req.user, id);
  res.status(200).json(getRankResponseSchema.parse(item));
}

/** PATCH /ranks/:id — edición. */
export async function updateRankHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateRankBody;
  const updated = await updateRank(req.user, id, body);
  res.status(200).json(updateRankResponseSchema.parse(updated));
}

/** DELETE /ranks/:id — soft delete. */
export async function deleteRankHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteRankById(req.user, id);
  res.status(200).json(deleteRankResponseSchema.parse(deleted));
}
