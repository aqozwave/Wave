import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createPermitChecklistItemResponseSchema,
  createPermitTypeRequirementResponseSchema,
  createPermitTypeResponseSchema,
  deletePermitChecklistItemResponseSchema,
  deletePermitTypeRequirementResponseSchema,
  deletePermitTypeResponseSchema,
  getPermitTypeResponseSchema,
  listPermitChecklistItemsResponseSchema,
  listPermitTypeRequirementsResponseSchema,
  listPermitTypesResponseSchema,
  updatePermitChecklistItemResponseSchema,
  updatePermitTypeRequirementResponseSchema,
  updatePermitTypeResponseSchema,
  type CreatePermitChecklistItemBody,
  type CreatePermitTypeBody,
  type CreatePermitTypeRequirementBody,
  type ListPermitTypesQuery,
  type UpdatePermitChecklistItemBody,
  type UpdatePermitTypeBody,
  type UpdatePermitTypeRequirementBody,
} from "./permitTypes.schemas.js";
import {
  createPermitChecklistItem,
  createPermitType,
  createPermitTypeRequirement,
  deletePermitChecklistItem,
  deletePermitType,
  deletePermitTypeRequirement,
  getPermitTypeById,
  listPermitChecklistItems,
  listPermitTypeRequirements,
  listPermitTypes,
  updatePermitChecklistItem,
  updatePermitType,
  updatePermitTypeRequirement,
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

/** POST /permit-types/:id/requirements — alta exigencia. */
export async function createPermitTypeRequirementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreatePermitTypeRequirementBody;
  const result = await createPermitTypeRequirement(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `requirement · ${result.key}`,
    metadata: { requirementId: result.id },
  });
  res.status(201).json(createPermitTypeRequirementResponseSchema.parse(result));
}

/** PATCH /permit-types/:id/requirements/:requirementId. */
export async function updatePermitTypeRequirementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdatePermitTypeRequirementBody;
  const result = await updatePermitTypeRequirement(
    req.user,
    req.params.id as string,
    req.params.requirementId as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `requirement · ${result.key}`,
    metadata: {
      requirementId: result.id,
      fields: safeChangedFields(body),
    },
  });
  res.status(200).json(updatePermitTypeRequirementResponseSchema.parse(result));
}

/** DELETE /permit-types/:id/requirements/:requirementId — active=false. */
export async function deletePermitTypeRequirementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deletePermitTypeRequirement(
    req.user,
    req.params.id as string,
    req.params.requirementId as string,
  );
  auditWrite(req, {
    action: "DELETE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `requirement · ${result.key}`,
    metadata: { requirementId: result.id },
  });
  res.status(200).json(deletePermitTypeRequirementResponseSchema.parse(result));
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

/** POST /permit-types/:id/checklist-items. */
export async function createPermitChecklistItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreatePermitChecklistItemBody;
  const result = await createPermitChecklistItem(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `checklist · #${result.order}`,
    metadata: { checklistItemId: result.id },
  });
  res.status(201).json(createPermitChecklistItemResponseSchema.parse(result));
}

/** PATCH /permit-types/:id/checklist-items/:itemId. */
export async function updatePermitChecklistItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdatePermitChecklistItemBody;
  const result = await updatePermitChecklistItem(
    req.user,
    req.params.id as string,
    req.params.itemId as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `checklist · #${result.order}`,
    metadata: {
      checklistItemId: result.id,
      fields: safeChangedFields(body),
    },
  });
  res.status(200).json(updatePermitChecklistItemResponseSchema.parse(result));
}

/** DELETE /permit-types/:id/checklist-items/:itemId — active=false. */
export async function deletePermitChecklistItemHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deletePermitChecklistItem(
    req.user,
    req.params.id as string,
    req.params.itemId as string,
  );
  auditWrite(req, {
    action: "DELETE",
    resource: "permitType",
    resourceId: result.permitTypeId,
    targetLabel: `checklist · #${result.order}`,
    metadata: { checklistItemId: result.id },
  });
  res.status(200).json(deletePermitChecklistItemResponseSchema.parse(result));
}
