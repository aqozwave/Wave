import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreatePermitChecklistItemBody,
  CreatePermitTypeBody,
  CreatePermitTypeRequirementBody,
  ListPermitTypesQuery,
  PermitChecklistItemResponse,
  PermitTypeRequirementResponse,
  PermitTypeResponse,
  UpdatePermitChecklistItemBody,
  UpdatePermitTypeBody,
  UpdatePermitTypeRequirementBody,
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

/** Include común al serializar exigencias. */
const requirementInclude = {
  documentType: { select: { id: true, code: true, name: true } },
  training: { select: { id: true, code: true, name: true } },
} as const;

/**
 * Resuelve documentType / training de la misma empresa del tipo.
 * Devuelve campos listos para Prisma create/update.
 */
async function resolveRequirementLinks(
  businessId: string,
  input: {
    kind: "document" | "training" | "checklist";
    documentTypeId?: string | null;
    accreditationScope?: "company" | "person" | null;
    trainingId?: string | null;
    trainingCode?: string | null;
  },
): Promise<{
  documentTypeId: string | null;
  accreditationScope: "company" | "person" | null;
  trainingId: string | null;
  trainingCode: string | null;
}> {
  let documentTypeId: string | null =
    input.documentTypeId === undefined ? null : input.documentTypeId;
  let accreditationScope: "company" | "person" | null =
    input.accreditationScope === undefined ? null : input.accreditationScope;
  let trainingId: string | null =
    input.trainingId === undefined ? null : input.trainingId;
  let trainingCode: string | null =
    input.trainingCode === undefined ? null : input.trainingCode;

  if (input.kind !== "document") {
    documentTypeId = null;
    accreditationScope = null;
  } else if (documentTypeId) {
    const doc = await prisma.documentType.findFirst({
      where: { id: documentTypeId, deletedAt: null, businessId },
    });
    if (!doc) {
      throw new AppError(
        400,
        "document_type_not_found",
        "Tipo de documento no encontrado en esta empresa",
      );
    }
  }

  if (input.kind !== "training") {
    trainingId = null;
    trainingCode = null;
  } else {
    if (trainingId) {
      const training = await prisma.training.findFirst({
        where: { id: trainingId, deletedAt: null, businessId },
      });
      if (!training) {
        throw new AppError(
          400,
          "training_not_found",
          "Capacitación no encontrada en esta empresa",
        );
      }
      trainingCode = training.code;
    } else if (trainingCode) {
      const training = await prisma.training.findFirst({
        where: {
          businessId,
          code: trainingCode,
          deletedAt: null,
        },
      });
      trainingId = training?.id ?? null;
    }
  }

  return {
    documentTypeId,
    accreditationScope,
    trainingId,
    trainingCode,
  };
}

/** Alta de exigencia bajo un tipo. */
export async function createPermitTypeRequirement(
  actor: Actor,
  permitTypeId: string,
  body: CreatePermitTypeRequirementBody,
): Promise<PermitTypeRequirementResponse> {
  const permitType = await getPermitTypeById(actor, permitTypeId);
  const links = await resolveRequirementLinks(permitType.businessId, {
    kind: body.kind,
    documentTypeId: body.documentTypeId,
    accreditationScope: body.accreditationScope,
    trainingId: body.trainingId,
    trainingCode: body.trainingCode,
  });

  try {
    const row = await prisma.permitTypeRequirement.create({
      data: {
        permitTypeId,
        key: body.key,
        kind: body.kind,
        scope: body.scope,
        moment: body.moment ?? "before",
        mandatory: body.mandatory ?? true,
        documentTypeId: links.documentTypeId,
        accreditationScope: links.accreditationScope,
        trainingId: links.trainingId,
        trainingCode: links.trainingCode,
        label: body.label,
        active: body.active ?? true,
      },
      include: requirementInclude,
    });
    return toRequirementResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_requirement_key",
        "Ya existe una exigencia con esa key en este tipo",
      );
    }
    throw err;
  }
}

/** PATCH de exigencia (pertenece al tipo). */
export async function updatePermitTypeRequirement(
  actor: Actor,
  permitTypeId: string,
  requirementId: string,
  payload: UpdatePermitTypeRequirementBody,
): Promise<PermitTypeRequirementResponse> {
  const permitType = await getPermitTypeById(actor, permitTypeId);
  const existing = await prisma.permitTypeRequirement.findFirst({
    where: { id: requirementId, permitTypeId },
  });
  if (!existing) {
    throw new AppError(
      404,
      "requirement_not_found",
      "Exigencia no encontrada",
    );
  }

  const nextKind = payload.kind ?? existing.kind;
  const links = await resolveRequirementLinks(permitType.businessId, {
    kind: nextKind,
    documentTypeId:
      payload.documentTypeId !== undefined
        ? payload.documentTypeId
        : existing.documentTypeId,
    accreditationScope:
      payload.accreditationScope !== undefined
        ? payload.accreditationScope
        : existing.accreditationScope,
    trainingId:
      payload.trainingId !== undefined
        ? payload.trainingId
        : existing.trainingId,
    trainingCode:
      payload.trainingCode !== undefined
        ? payload.trainingCode
        : existing.trainingCode,
  });

  const data: Prisma.PermitTypeRequirementUpdateInput = {};
  if (payload.key !== undefined) data.key = payload.key;
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.scope !== undefined) data.scope = payload.scope;
  if (payload.moment !== undefined) data.moment = payload.moment;
  if (payload.mandatory !== undefined) data.mandatory = payload.mandatory;
  if (payload.label !== undefined) data.label = payload.label;
  if (payload.active !== undefined) data.active = payload.active;

  // Siempre reescribe links según kind resultante (limpia campos ajenos).
  data.documentType =
    links.documentTypeId === null
      ? { disconnect: true }
      : { connect: { id: links.documentTypeId } };
  data.accreditationScope = links.accreditationScope;
  data.training =
    links.trainingId === null
      ? { disconnect: true }
      : { connect: { id: links.trainingId } };
  data.trainingCode = links.trainingCode;

  try {
    const updated = await prisma.permitTypeRequirement.update({
      where: { id: requirementId },
      data,
      include: requirementInclude,
    });
    return toRequirementResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_requirement_key",
        "Ya existe una exigencia con esa key en este tipo",
      );
    }
    throw err;
  }
}

/** Desactiva exigencia (active=false); no hay deletedAt en el modelo. */
export async function deletePermitTypeRequirement(
  actor: Actor,
  permitTypeId: string,
  requirementId: string,
): Promise<PermitTypeRequirementResponse> {
  await getPermitTypeById(actor, permitTypeId);
  const existing = await prisma.permitTypeRequirement.findFirst({
    where: { id: requirementId, permitTypeId, active: true },
    include: requirementInclude,
  });
  if (!existing) {
    throw new AppError(
      404,
      "requirement_not_found",
      "Exigencia no encontrada",
    );
  }

  const updated = await prisma.permitTypeRequirement.update({
    where: { id: requirementId },
    data: { active: false },
    include: requirementInclude,
  });
  return toRequirementResponse(updated);
}

/** Alta de ítem de checklist; order omitido → al final. */
export async function createPermitChecklistItem(
  actor: Actor,
  permitTypeId: string,
  body: CreatePermitChecklistItemBody,
): Promise<PermitChecklistItemResponse> {
  await getPermitTypeById(actor, permitTypeId);

  let order = body.order;
  if (order === undefined) {
    const agg = await prisma.permitChecklistItem.aggregate({
      where: { permitTypeId },
      _max: { order: true },
    });
    order = (agg._max.order ?? 0) + 1;
  }

  try {
    const row = await prisma.permitChecklistItem.create({
      data: {
        permitTypeId,
        order,
        text: body.text,
        active: body.active ?? true,
      },
    });
    return toChecklistItemResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_checklist_order",
        "Ya existe un ítem con ese orden en este tipo",
      );
    }
    throw err;
  }
}

/** PATCH de ítem de checklist. */
export async function updatePermitChecklistItem(
  actor: Actor,
  permitTypeId: string,
  itemId: string,
  payload: UpdatePermitChecklistItemBody,
): Promise<PermitChecklistItemResponse> {
  await getPermitTypeById(actor, permitTypeId);
  const existing = await prisma.permitChecklistItem.findFirst({
    where: { id: itemId, permitTypeId },
  });
  if (!existing) {
    throw new AppError(
      404,
      "checklist_item_not_found",
      "Ítem de checklist no encontrado",
    );
  }

  const data: Prisma.PermitChecklistItemUpdateInput = {};
  if (payload.order !== undefined) data.order = payload.order;
  if (payload.text !== undefined) data.text = payload.text;
  if (payload.active !== undefined) data.active = payload.active;

  try {
    const updated = await prisma.permitChecklistItem.update({
      where: { id: itemId },
      data,
    });
    return toChecklistItemResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_checklist_order",
        "Ya existe un ítem con ese orden en este tipo",
      );
    }
    throw err;
  }
}

/** Desactiva ítem (active=false). */
export async function deletePermitChecklistItem(
  actor: Actor,
  permitTypeId: string,
  itemId: string,
): Promise<PermitChecklistItemResponse> {
  await getPermitTypeById(actor, permitTypeId);
  const existing = await prisma.permitChecklistItem.findFirst({
    where: { id: itemId, permitTypeId, active: true },
  });
  if (!existing) {
    throw new AppError(
      404,
      "checklist_item_not_found",
      "Ítem de checklist no encontrado",
    );
  }

  const updated = await prisma.permitChecklistItem.update({
    where: { id: itemId },
    data: { active: false },
  });
  return toChecklistItemResponse(updated);
}
