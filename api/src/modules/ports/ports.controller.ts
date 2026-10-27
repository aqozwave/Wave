import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createPortResponseSchema,
  deletePortResponseSchema,
  getPortResponseSchema,
  listPortsResponseSchema,
  updatePortResponseSchema,
  type CreatePortBody,
  type ListPortsQuery,
  type UpdatePortBody,
} from "./ports.schemas.js";
import {
  createPort,
  deletePortById,
  getPortById,
  listPorts,
  updatePort,
} from "./ports.service.js";

/** GET /ports — listado scoped por tenant. */
export async function listPortsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListPortsQuery;
  const result = await listPorts(req.user, query);
  res.status(200).json(listPortsResponseSchema.parse(result));
}

/** POST /ports — alta (admin o superadmin). */
export async function createPortHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreatePortBody;
  const created = await createPort(req.user, body);
  res.status(201).json(createPortResponseSchema.parse(created));
}

/** GET /ports/:id — detalle. */
export async function getPortHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getPortById(req.user, id);
  res.status(200).json(getPortResponseSchema.parse(item));
}

/** PATCH /ports/:id — edición. */
export async function updatePortHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdatePortBody;
  const updated = await updatePort(req.user, id, body);
  res.status(200).json(updatePortResponseSchema.parse(updated));
}

/** DELETE /ports/:id — soft delete. */
export async function deletePortHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deletePortById(req.user, id);
  res.status(200).json(deletePortResponseSchema.parse(deleted));
}
