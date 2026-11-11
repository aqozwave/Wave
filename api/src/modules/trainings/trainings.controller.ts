import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createTrainingResponseSchema,
  deleteTrainingResponseSchema,
  getTrainingResponseSchema,
  listTrainingsResponseSchema,
  updateTrainingResponseSchema,
  type CreateTrainingBody,
  type ListTrainingsQuery,
  type UpdateTrainingBody,
} from "./trainings.schemas.js";
import {
  createTraining,
  deleteTraining,
  getTrainingById,
  listTrainings,
  updateTraining,
} from "./trainings.service.js";

/** GET /trainings — listado paginado. */
export async function listTrainingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListTrainingsQuery;
  const result = await listTrainings(req.user, query);
  res.status(200).json(listTrainingsResponseSchema.parse(result));
}

/** POST /trainings — alta. */
export async function createTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateTrainingBody;
  const result = await createTraining(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "training",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
  });
  res.status(201).json(createTrainingResponseSchema.parse(result));
}

/** GET /trainings/:id — detalle. */
export async function getTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getTrainingById(req.user, req.params.id as string);
  res.status(200).json(getTrainingResponseSchema.parse(result));
}

/** PATCH /trainings/:id — editar / desactivar (active). */
export async function updateTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdateTrainingBody;
  const result = await updateTraining(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "training",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateTrainingResponseSchema.parse(result));
}

/** DELETE /trainings/:id — soft delete. */
export async function deleteTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteTraining(req.user, req.params.id as string);
  auditWrite(req, {
    action: "DELETE",
    resource: "training",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
  });
  res.status(200).json(deleteTrainingResponseSchema.parse(result));
}
