import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createCrewMemberResponseSchema,
  deleteCrewMemberResponseSchema,
  getCrewMemberResponseSchema,
  listCrewMembersResponseSchema,
  updateCrewMemberResponseSchema,
  type CreateCrewMemberBody,
  type ListCrewMembersQuery,
  type UpdateCrewMemberBody,
} from "./crewMembers.schemas.js";
import {
  createCrewMember,
  deleteCrewMemberById,
  getCrewMemberById,
  listCrewMembers,
  updateCrewMember,
} from "./crewMembers.service.js";

/** Etiqueta legible del tripulante para auditoría. */
function crewLabel(row: {
  firstName: string;
  lastName: string;
  run: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.run;
}

/** GET /crew-members — listado paginado scoped. */
export async function listCrewMembersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListCrewMembersQuery;
  const result = await listCrewMembers(req.user, query);
  res.status(200).json(listCrewMembersResponseSchema.parse(result));
}

/** POST /crew-members — alta. */
export async function createCrewMemberHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateCrewMemberBody;
  const created = await createCrewMember(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "crewMember",
    resourceId: created.id,
    targetLabel: crewLabel(created),
  });
  res.status(201).json(createCrewMemberResponseSchema.parse(created));
}

/** GET /crew-members/:id — ficha. */
export async function getCrewMemberHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getCrewMemberById(req.user, id);
  res.status(200).json(getCrewMemberResponseSchema.parse(item));
}

/** PATCH /crew-members/:id — edición. */
export async function updateCrewMemberHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateCrewMemberBody;
  const updated = await updateCrewMember(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: updated.id,
    targetLabel: crewLabel(updated),
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateCrewMemberResponseSchema.parse(updated));
}

/** DELETE /crew-members/:id — soft delete. */
export async function deleteCrewMemberHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteCrewMemberById(req.user, id);
  auditWrite(req, {
    action: "DELETE",
    resource: "crewMember",
    resourceId: deleted.id,
    targetLabel: crewLabel(deleted),
  });
  res.status(200).json(deleteCrewMemberResponseSchema.parse(deleted));
}
