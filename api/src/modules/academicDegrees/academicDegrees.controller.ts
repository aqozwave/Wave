import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createAcademicDegreeResponseSchema,
  deleteAcademicDegreeResponseSchema,
  getAcademicDegreeResponseSchema,
  listAcademicDegreesResponseSchema,
  updateAcademicDegreeResponseSchema,
  type CreateAcademicDegreeBody,
  type ListAcademicDegreesQuery,
  type UpdateAcademicDegreeBody,
} from "./academicDegrees.schemas.js";
import {
  createAcademicDegree,
  deleteAcademicDegreeById,
  getAcademicDegreeById,
  listAcademicDegrees,
  updateAcademicDegree,
} from "./academicDegrees.service.js";

/** GET /academic-degrees — listado scoped por tenant. */
export async function listAcademicDegreesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListAcademicDegreesQuery;
  const result = await listAcademicDegrees(req.user, query);
  res.status(200).json(listAcademicDegreesResponseSchema.parse(result));
}

/** POST /academic-degrees — alta (admin o superadmin). */
export async function createAcademicDegreeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateAcademicDegreeBody;
  const created = await createAcademicDegree(req.user, body);
  res.status(201).json(createAcademicDegreeResponseSchema.parse(created));
}

/** GET /academic-degrees/:id — detalle. */
export async function getAcademicDegreeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getAcademicDegreeById(req.user, id);
  res.status(200).json(getAcademicDegreeResponseSchema.parse(item));
}

/** PATCH /academic-degrees/:id — edición. */
export async function updateAcademicDegreeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateAcademicDegreeBody;
  const updated = await updateAcademicDegree(req.user, id, body);
  res.status(200).json(updateAcademicDegreeResponseSchema.parse(updated));
}

/** DELETE /academic-degrees/:id — soft delete. */
export async function deleteAcademicDegreeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteAcademicDegreeById(req.user, id);
  res.status(200).json(deleteAcademicDegreeResponseSchema.parse(deleted));
}
