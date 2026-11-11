import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  createCrewMemberLogEntryResponseSchema,
  createCrewMemberResponseSchema,
  crewAccessResponseSchema,
  deleteCrewMemberLogEntryResponseSchema,
  deleteCrewMemberResponseSchema,
  getCrewMemberResponseSchema,
  listCrewMemberHistoryResponseSchema,
  listCrewMembersResponseSchema,
  updateCrewMemberResponseSchema,
  type ChangeCrewMemberAccessRoleBody,
  type CreateCrewMemberBody,
  type CreateCrewMemberLogEntryBody,
  type GrantCrewMemberAccessBody,
  type ListCrewMemberHistoryQuery,
  type ListCrewMembersQuery,
  type UpdateCrewMemberBody,
} from "./crewMembers.schemas.js";
import {
  changeCrewMemberAccessRole,
  createCrewMember,
  createCrewMemberLogEntry,
  deleteCrewMemberById,
  deleteCrewMemberLogEntry,
  getCrewMemberAccess,
  getCrewMemberById,
  grantCrewMemberAccess,
  listCrewMemberHistory,
  listCrewMembers,
  revokeCrewMemberAccess,
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

/** GET /crew-members/:id/history — bitácora D31. */
export async function listCrewMemberHistoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const query = req.query as unknown as ListCrewMemberHistoryQuery;
  const result = await listCrewMemberHistory(req.user, id, query);
  res.status(200).json(listCrewMemberHistoryResponseSchema.parse(result));
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
  const result = await updateCrewMember(req.user, id, body);
  // Solo audita si hubo cambio real (evita falso “embarque” por reenviar locationId).
  if (result.changedFields.length > 0) {
    auditWrite(req, {
      action: "UPDATE",
      resource: "crewMember",
      resourceId: result.crew.id,
      targetLabel: crewLabel(result.crew),
      metadata: { fields: result.changedFields },
    });
  }
  res.status(200).json(updateCrewMemberResponseSchema.parse(result.crew));
}

/** POST /crew-members/:id/log-entries — observación / amonestación / embarque. */
export async function createCrewMemberLogEntryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberLogEntryBody;
  const created = await createCrewMemberLogEntry(req.user, id, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: created.note.slice(0, 120),
    metadata: {
      kind: "crew_member_log_entry",
      entryId: created.id,
      entryKind: created.kind,
    },
  });
  res
    .status(201)
    .json(createCrewMemberLogEntryResponseSchema.parse(created));
}

/** DELETE /crew-members/:id/log-entries/:entryId — soft delete. */
export async function deleteCrewMemberLogEntryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, entryId } = req.params as { id: string; entryId: string };
  const deleted = await deleteCrewMemberLogEntry(req.user, id, entryId);
  auditWrite(req, {
    action: "DELETE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: deleted.note.slice(0, 120),
    metadata: {
      kind: "crew_member_log_entry",
      entryId: deleted.id,
      entryKind: deleted.kind,
    },
  });
  res
    .status(200)
    .json(deleteCrewMemberLogEntryResponseSchema.parse(deleted));
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

/** GET /crew-members/:id/access — estado Acceso (Figma D44). */
export async function getCrewMemberAccessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await getCrewMemberAccess(req.user, id);
  res.status(200).json(crewAccessResponseSchema.parse(result));
}

/** POST /crew-members/:id/access — otorgar acceso / invitar (Figma D45). */
export async function grantCrewMemberAccessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as GrantCrewMemberAccessBody;
  const result = await grantCrewMemberAccess(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: result.user
      ? `${result.user.firstName} ${result.user.lastName}`.trim()
      : id,
    metadata: {
      fields: ["access.grant"],
      email: result.user?.email,
      roleKey: result.user?.roleKey,
    },
  });
  res.status(201).json(crewAccessResponseSchema.parse(result));
}

/** PATCH /crew-members/:id/access — cambiar rol User ↔ Colaborador (D46). */
export async function changeCrewMemberAccessRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as ChangeCrewMemberAccessRoleBody;
  const result = await changeCrewMemberAccessRole(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: result.user
      ? `${result.user.firstName} ${result.user.lastName}`.trim()
      : id,
    metadata: {
      fields: ["access.role"],
      roleKey: body.roleKey,
    },
  });
  res.status(200).json(crewAccessResponseSchema.parse(result));
}

/** DELETE /crew-members/:id/access — desvincular cuenta (D44m). */
export async function revokeCrewMemberAccessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await revokeCrewMemberAccess(req.user, id);
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: id,
    metadata: { fields: ["access.revoke"] },
  });
  res.status(200).json(crewAccessResponseSchema.parse(result));
}
