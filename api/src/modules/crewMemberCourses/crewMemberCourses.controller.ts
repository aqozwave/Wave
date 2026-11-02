import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createCrewMemberCourseResponseSchema,
  deleteCrewMemberCourseResponseSchema,
  getCrewMemberCourseResponseSchema,
  listCrewMemberCoursesResponseSchema,
  listExpiringCrewMemberCoursesResponseSchema,
  updateCrewMemberCourseResponseSchema,
  type CreateCrewMemberCourseBody,
  type ListExpiringCrewMemberCoursesQuery,
  type UpdateCrewMemberCourseBody,
} from "./crewMemberCourses.schemas.js";
import {
  createCrewMemberCourse,
  deleteCrewMemberCourse,
  getCrewMemberCourseById,
  listCrewMemberCourses,
  listExpiringCrewMemberCourses,
  updateCrewMemberCourse,
} from "./crewMemberCourses.service.js";

/** GET /crew-members/:id/courses — listado de la ficha. */
export async function listCrewMemberCoursesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await listCrewMemberCourses(req.user, id);
  res.status(200).json(listCrewMemberCoursesResponseSchema.parse(result));
}

/**
 * GET /crew-member-courses — vencimientos globales (cursos).
 * Usado por la pantalla /cursos/vencimientos.
 */
export async function listExpiringCrewMemberCoursesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListExpiringCrewMemberCoursesQuery;
  const result = await listExpiringCrewMemberCourses(req.user, query);
  res
    .status(200)
    .json(listExpiringCrewMemberCoursesResponseSchema.parse(result));
}

/** GET /crew-members/:id/courses/:assignmentId — detalle. */
export async function getCrewMemberCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const item = await getCrewMemberCourseById(req.user, id, assignmentId);
  res.status(200).json(getCrewMemberCourseResponseSchema.parse(item));
}

/** POST /crew-members/:id/courses — alta manual. */
export async function createCrewMemberCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberCourseBody;
  const created = await createCrewMemberCourse(req.user, id, body);
  res.status(201).json(createCrewMemberCourseResponseSchema.parse(created));
}

/** PATCH /crew-members/:id/courses/:assignmentId — fechas/estado. */
export async function updateCrewMemberCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const body = req.body as UpdateCrewMemberCourseBody;
  const updated = await updateCrewMemberCourse(req.user, id, assignmentId, body);
  res.status(200).json(updateCrewMemberCourseResponseSchema.parse(updated));
}

/** DELETE /crew-members/:id/courses/:assignmentId — soft delete. */
export async function deleteCrewMemberCourseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const deleted = await deleteCrewMemberCourse(req.user, id, assignmentId);
  res.status(200).json(deleteCrewMemberCourseResponseSchema.parse(deleted));
}
