import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createPermitTypeResponseSchema,
  deletePermitTypeResponseSchema,
  getPermitTypeResponseSchema,
  listPermitChecklistItemsResponseSchema,
  listPermitTypeRequirementsResponseSchema,
  listPermitTypesResponseSchema,
  updatePermitTypeResponseSchema,
  type CreatePermitTypeBody,
  type ListPermitTypesQuery,
  type UpdatePermitTypeBody,
} from "./permitTypes.schemas.js";
import {
  createPermitType,
  deletePermitType,
  getPermitTypeById,
  listPermitChecklistItems,
  listPermitTypeRequirements,
  listPermitTypes,
  updatePermitType,
} from "./permitTypes.service.js";

/** GET /permit-types — listado paginado del catálogo. */
export async function listPermitTypesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListPermitTypesQuery;
  const result = await listPermitTypes(req.user, query);
  res.status(200).json(listPermitTypesResponseSchema.parse(result));
}

/** POST /permit-types — alta (P14m). */
export async function createPermitTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreatePermitTypeBody;
  const result = await createPermitType(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "permitType",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
  });
  res.status(201).json(createPermitTypeResponseSchema.parse(result));
}

/** GET /permit-types/:id — detalle de un tipo. */
export async function getPermitTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getPermitTypeById(req.user, req.params.id as string);
  res.status(200).json(getPermitTypeResponseSchema.parse(result));
}

/** PATCH /permit-types/:id — editar / desactivar (active). */
export async function updatePermitTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdatePermitTypeBody;
  const result = await updatePermitType(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "permitType",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updatePermitTypeResponseSchema.parse(result));
}

/** DELETE /permit-types/:id — soft delete. */
export async function deletePermitTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deletePermitType(req.user, req.params.id as string);
  auditWrite(req, {
    action: "DELETE",
    resource: "permitType",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.name}`,
  });
  res.status(200).json(deletePermitTypeResponseSchema.parse(result));
}

/** GET /permit-types/:id/requirements — exigencias del tipo (P15). */
export async function listPermitTypeRequirementsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listPermitTypeRequirements(
    req.user,
    req.params.id as string,
  );
  res.status(200).json(listPermitTypeRequirementsResponseSchema.parse(result));
}

/** GET /permit-types/:id/checklist-items — ítems del checklist del tipo. */
export async function listPermitChecklistItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listPermitChecklistItems(
    req.user,
    req.params.id as string,
  );
  res.status(200).json(listPermitChecklistItemsResponseSchema.parse(result));
}
