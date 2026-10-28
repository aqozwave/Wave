import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createCrewMemberMuelleResponseSchema,
  createCrewMemberTravesiaResponseSchema,
  deleteCrewMemberMuelleResponseSchema,
  deleteCrewMemberTravesiaResponseSchema,
  listCrewMemberMuellesResponseSchema,
  listCrewMemberTravesiasResponseSchema,
  type CreateCrewMemberMuelleBody,
  type CreateCrewMemberTravesiaBody,
} from "./crewMemberAssignments.schemas.js";
import {
  createCrewMemberMuelle,
  createCrewMemberTravesia,
  deleteCrewMemberMuelle,
  deleteCrewMemberTravesia,
  listCrewMemberMuelles,
  listCrewMemberTravesias,
} from "./crewMemberAssignments.service.js";

/** GET /crew-members/:id/muelles */
export async function listCrewMemberMuellesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const result = await listCrewMemberMuelles(req.user, id);
  res.status(200).json(listCrewMemberMuellesResponseSchema.parse(result));
}

/** POST /crew-members/:id/muelles */
export async function createCrewMemberMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberMuelleBody;
  const created = await createCrewMemberMuelle(req.user, id, body);
  res.status(201).json(createCrewMemberMuelleResponseSchema.parse(created));
}

/** DELETE /crew-members/:id/muelles/:assignmentId */
export async function deleteCrewMemberMuelleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const deleted = await deleteCrewMemberMuelle(req.user, id, assignmentId);
  res.status(200).json(deleteCrewMemberMuelleResponseSchema.parse(deleted));
}

/** GET /crew-members/:id/travesias */
export async function listCrewMemberTravesiasHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const result = await listCrewMemberTravesias(req.user, id);
  res.status(200).json(listCrewMemberTravesiasResponseSchema.parse(result));
}

/** POST /crew-members/:id/travesias */
export async function createCrewMemberTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberTravesiaBody;
  const created = await createCrewMemberTravesia(req.user, id, body);
  res.status(201).json(createCrewMemberTravesiaResponseSchema.parse(created));
}

/** DELETE /crew-members/:id/travesias/:assignmentId */
export async function deleteCrewMemberTravesiaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const deleted = await deleteCrewMemberTravesia(req.user, id, assignmentId);
  res.status(200).json(deleteCrewMemberTravesiaResponseSchema.parse(deleted));
}
