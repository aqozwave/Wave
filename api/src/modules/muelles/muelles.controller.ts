import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createMuelleResponseSchema,
  deleteMuelleResponseSchema,
  getMuelleResponseSchema,
  listMuellesResponseSchema,
  updateMuelleResponseSchema,
  type CreateMuelleBody,
  type ListMuellesQuery,
  type UpdateMuelleBody,
} from "./muelles.schemas.js";
import {
  createMuelle,
  deleteMuelleById,
  getMuelleById,
  listMuelles,
  updateMuelle,
} from "./muelles.service.js";

/** GET /muelles — listado scoped por tenant. */
export async function listMuellesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListMuellesQuery;
  const result = await listMuelles(req.user, query);
  res.status(200).json(listMuellesResponseSchema.parse(result));
}

/** POST /muelles — alta (admin o superadmin). */
export async function createMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateMuelleBody;
  const created = await createMuelle(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "muelle",
    resourceId: created.id,
    targetLabel: created.name,
  });
  res.status(201).json(createMuelleResponseSchema.parse(created));
}

/** GET /muelles/:id — detalle. */
export async function getMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getMuelleById(req.user, id);
  res.status(200).json(getMuelleResponseSchema.parse(item));
}

/** PATCH /muelles/:id — edición. */
export async function updateMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateMuelleBody;
  const updated = await updateMuelle(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "muelle",
    resourceId: updated.id,
    targetLabel: updated.name,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateMuelleResponseSchema.parse(updated));
}

/** DELETE /muelles/:id — soft delete. */
export async function deleteMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteMuelleById(req.user, id);
  auditWrite(req, {
    action: "DELETE",
    resource: "muelle",
    resourceId: deleted.id,
    targetLabel: deleted.name,
  });
  res.status(200).json(deleteMuelleResponseSchema.parse(deleted));
}
