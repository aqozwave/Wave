import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createCourseResponseSchema,
  deleteCourseResponseSchema,
  getCourseResponseSchema,
  listCoursesResponseSchema,
  updateCourseResponseSchema,
  type CreateCourseBody,
  type ListCoursesQuery,
  type UpdateCourseBody,
} from "./courses.schemas.js";
import {
  createCourse,
  deleteCourseById,
  getCourseById,
  listCourses,
  updateCourse,
} from "./courses.service.js";

/** GET /courses — listado scoped por tenant. */
export async function listCoursesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListCoursesQuery;
  const result = await listCourses(req.user, query);
  res.status(200).json(listCoursesResponseSchema.parse(result));
}

/** POST /courses — alta (admin o superadmin). */
export async function createCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateCourseBody;
  const created = await createCourse(req.user, body);
  res.status(201).json(createCourseResponseSchema.parse(created));
}

/** GET /courses/:id — detalle. */
export async function getCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getCourseById(req.user, id);
  res.status(200).json(getCourseResponseSchema.parse(item));
}

/** PATCH /courses/:id — edición. */
export async function updateCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateCourseBody;
  const updated = await updateCourse(req.user, id, body);
  res.status(200).json(updateCourseResponseSchema.parse(updated));
}

/** DELETE /courses/:id — soft delete. */
export async function deleteCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteCourseById(req.user, id);
  res.status(200).json(deleteCourseResponseSchema.parse(deleted));
}
