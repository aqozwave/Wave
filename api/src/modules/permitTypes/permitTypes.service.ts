import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreatePermitTypeBody,
  ListPermitTypesQuery,
  PermitChecklistItemResponse,
  PermitTypeRequirementResponse,
  PermitTypeResponse,
  UpdatePermitTypeBody,
} from "./permitTypes.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toPermitTypeResponse(row: {
  id: string;
  businessId: string;
  code: string;
  name: string;
  criticality: "low" | "medium" | "high";
  requiresAst: boolean;
  astMode: "form" | "pdf" | "both" | null;
  description: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PermitTypeResponse {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    name: row.name,
    criticality: row.criticality,
    requiresAst: row.requiresAst,
    astMode: row.astMode,
    description: row.description,
    active: row.active,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado: superadmin ve todas (o filtra businessId);
 * resto solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListPermitTypesQuery,
): Prisma.PermitTypeWhereInput {
  const base: Prisma.PermitTypeWhereInput = { deletedAt: null };

  if (query.active !== undefined) {
    base.active = query.active;
  }

  if (query.search && query.search.length > 0) {
    base.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { name: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (actor.internalRol === "superadmin") {
    if (query.businessId) {
      return { ...base, businessId: query.businessId };
    }
    return base;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  return { ...base, businessId: actor.businessId };
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertPermitTypeTenantAccess(
  actor: Actor,
  permitBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== permitBusinessId) {
    throw new AppError(
      404,
      "permit_type_not_found",
      "Tipo de permiso no encontrado",
    );
  }
}

/** Lista tipos de permiso visibles para el actor (paginado). */
export async function listPermitTypes(
  actor: Actor,
  query: ListPermitTypesQuery,
): Promise<{
  items: PermitTypeResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.permitType.findMany({
      where,
      orderBy: [{ code: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.permitType.count({ where }),
  ]);

  return {
    items: rows.map(toPermitTypeResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (mismo aislamiento tenant que el listado). */
export async function getPermitTypeById(
  actor: Actor,
  id: string,
): Promise<PermitTypeResponse> {
  const row = await prisma.permitType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "permit_type_not_found",
      "Tipo de permiso no encontrado",
    );
  }
  assertPermitTypeTenantAccess(actor, row.businessId);
  return toPermitTypeResponse(row);
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreatePermitTypeBody,
): string {
  if (actor.internalRol === "admin") {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    return actor.businessId;
  }

  if (!body.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido para crear un tipo de permiso",
    );
  }
  return body.businessId;
}

/** Normaliza AST: sin requiresAst → astMode null. */
function resolveAstFields(input: {
  requiresAst?: boolean;
  astMode?: "form" | "pdf" | "both" | null;
}): { requiresAst: boolean; astMode: "form" | "pdf" | "both" | null } {
  const requiresAst = input.requiresAst ?? false;
  if (!requiresAst) {
    return { requiresAst: false, astMode: null };
  }
  return { requiresAst: true, astMode: input.astMode ?? null };
}

/** Alta de tipo de permiso (P14m). */
export async function createPermitType(
  actor: Actor,
  body: CreatePermitTypeBody,
): Promise<PermitTypeResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  const ast = resolveAstFields(body);

  try {
    const row = await prisma.permitType.create({
      data: {
        businessId,
        code: body.code,
        name: body.name,
        criticality: body.criticality,
        requiresAst: ast.requiresAst,
        astMode: ast.astMode,
        description: body.description ?? null,
        active: body.active ?? true,
      },
    });
    return toPermitTypeResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_permit_type_code",
        "Ya existe un tipo con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/** PATCH de tipo (datos / active). */
export async function updatePermitType(
  actor: Actor,
  id: string,
  payload: UpdatePermitTypeBody,
): Promise<PermitTypeResponse> {
  const existing = await prisma.permitType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "permit_type_not_found",
      "Tipo de permiso no encontrado",
    );
  }
  assertPermitTypeTenantAccess(actor, existing.businessId);

  const data: Prisma.PermitTypeUpdateInput = {};
  if (payload.code !== undefined) data.code = payload.code;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.criticality !== undefined) data.criticality = payload.criticality;
  if (payload.description !== undefined) {
    data.description = payload.description ?? null;
  }
  if (payload.active !== undefined) data.active = payload.active;

  if (payload.requiresAst !== undefined || payload.astMode !== undefined) {
    const ast = resolveAstFields({
      requiresAst: payload.requiresAst ?? existing.requiresAst,
      astMode:
        payload.astMode !== undefined ? payload.astMode : existing.astMode,
    });
    data.requiresAst = ast.requiresAst;
    data.astMode = ast.astMode;
  }

  if (payload.businessId !== undefined) {
    if (
      actor.internalRol === "admin" &&
      payload.businessId !== actor.businessId
    ) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover el tipo a otra empresa",
      );
    }
    const business = await prisma.business.findFirst({
      where: { id: payload.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "business_not_found", "Empresa no encontrada");
    }
    data.business = { connect: { id: payload.businessId } };
  }

  try {
    const updated = await prisma.permitType.update({
      where: { id },
      data,
    });
    return toPermitTypeResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_permit_type_code",
        "Ya existe un tipo con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete (P15m Desactivar tipo en sentido fuerte).
 * Marca deletedAt y active=false; no borra exigencias/checklist.
 */
export async function deletePermitType(
  actor: Actor,
  id: string,
): Promise<PermitTypeResponse> {
  const existing = await prisma.permitType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "permit_type_not_found",
      "Tipo de permiso no encontrado",
    );
  }
  assertPermitTypeTenantAccess(actor, existing.businessId);

  const updated = await prisma.permitType.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
  });
  return toPermitTypeResponse(updated);
}

/** Serializa exigencia (+ tipo de documento opcional). */
function toRequirementResponse(row: {
  id: string;
  permitTypeId: string;
  key: string;
  kind: "document" | "training" | "checklist";
  scope: "company" | "person" | "permit";
  moment: "before" | "closure";
  mandatory: boolean;
  documentTypeId: string | null;
  accreditationScope: "company" | "person" | null;
  trainingCode: string | null;
  trainingId: string | null;
  label: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  documentType: { id: string; code: string; name: string } | null;
  training: { id: string; code: string; name: string } | null;
}): PermitTypeRequirementResponse {
  return {
    id: row.id,
    permitTypeId: row.permitTypeId,
    key: row.key,
    kind: row.kind,
    scope: row.scope,
    moment: row.moment,
    mandatory: row.mandatory,
    documentTypeId: row.documentTypeId,
    documentType: row.documentType,
    accreditationScope: row.accreditationScope,
    trainingCode: row.trainingCode,
    trainingId: row.trainingId,
    training: row.training,
    label: row.label,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Lista exigencias de un tipo (P15).
 * Comprueba que el tipo exista y sea visible para el actor.
 */
export async function listPermitTypeRequirements(
  actor: Actor,
  permitTypeId: string,
): Promise<{ items: PermitTypeRequirementResponse[]; total: number }> {
  // Reusa get: 404 + tenant.
  await getPermitTypeById(actor, permitTypeId);

  const rows = await prisma.permitTypeRequirement.findMany({
    where: { permitTypeId, active: true },
    include: {
      documentType: {
        select: { id: true, code: true, name: true },
      },
      training: {
        select: { id: true, code: true, name: true },
      },
    },
    orderBy: [{ moment: "asc" }, { kind: "asc" }, { key: "asc" }],
  });

  return {
    items: rows.map(toRequirementResponse),
    total: rows.length,
  };
}

/** Serializa ítem de checklist. */
function toChecklistItemResponse(row: {
  id: string;
  permitTypeId: string;
  order: number;
  text: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PermitChecklistItemResponse {
  return {
    id: row.id,
    permitTypeId: row.permitTypeId,
    order: row.order,
    text: row.text,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Lista ítems del checklist de un tipo (ordenados).
 * 404 si el tipo no es visible para el actor.
 */
export async function listPermitChecklistItems(
  actor: Actor,
  permitTypeId: string,
): Promise<{ items: PermitChecklistItemResponse[]; total: number }> {
  await getPermitTypeById(actor, permitTypeId);

  const rows = await prisma.permitChecklistItem.findMany({
    where: { permitTypeId, active: true },
    orderBy: [{ order: "asc" }],
  });

  return {
    items: rows.map(toChecklistItemResponse),
    total: rows.length,
  };
}
