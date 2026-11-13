import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createRoleResponseSchema,
  deleteRoleResponseSchema,
  getRoleResponseSchema,
  listRolesResponseSchema,
  permissionCatalogResponseSchema,
  updateRoleResponseSchema,
  type CreateRoleBody,
  type ListRolesQuery,
  type UpdateRoleBody,
} from "./roles.schemas.js";
import {
  createRole,
  deleteRoleById,
  getPermissionCatalog,
  getRoleById,
  listRoles,
  updateRole,
} from "./roles.service.js";

/** GET /roles — listado filtrado por tenant del actor. */
export async function listRolesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListRolesQuery;
  const result = await listRoles(req.user, query);
  res.status(200).json(listRolesResponseSchema.parse(result));
}

/** GET /roles/catalog — matriz de permisos para UI (opcional ?businessId= S3b). */
export async function getPermissionCatalogHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as { businessId?: string };
  const catalog = await getPermissionCatalog({
    businessId: query.businessId,
  });
  res.status(200).json(permissionCatalogResponseSchema.parse(catalog));
}

/** GET /roles/:id */
export async function getRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getRoleById(req.user, id);
  res.status(200).json(getRoleResponseSchema.parse(item));
}

/** POST /roles */
export async function createRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateRoleBody;
  const created = await createRole(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "role",
    resourceId: created.id,
    targetLabel: created.name,
  });
  res.status(201).json(createRoleResponseSchema.parse(created));
}

/** PATCH /roles/:id */
export async function updateRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateRoleBody;
  const updated = await updateRole(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "role",
    resourceId: updated.id,
    targetLabel: updated.name,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateRoleResponseSchema.parse(updated));
}

/** DELETE /roles/:id — soft. */
export async function deleteRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteRoleById(req.user, id);
  auditWrite(req, {
    action: "DELETE",
    resource: "role",
    resourceId: deleted.id,
    targetLabel: deleted.name,
  });
  res.status(200).json(deleteRoleResponseSchema.parse(deleted));
}
