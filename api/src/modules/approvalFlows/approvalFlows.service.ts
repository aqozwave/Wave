import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import {
  MAX_APPROVAL_FLOW_STAGES,
  type ApprovalFlowDetail,
  type ApprovalFlowListItem,
  type CreateApprovalFlowBody,
  type CreateApprovalFlowStageBody,
  type ListApprovalFlowsQuery,
  type UpdateApprovalFlowBody,
  type UpdateApprovalFlowStageBody,
} from "./approvalFlows.schemas.js";

/** Actor mínimo (P16 · rutas Superadmin). */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Fila Prisma con conteos para listado. */
type FlowWithCounts = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  copiedFromId: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { stages: number; permitTypes: number };
};

/** Etapa Prisma para detalle. */
type StageRow = {
  id: string;
  flowId: string;
  position: number;
  key: string;
  label: string;
  actor: "requesting_area" | "prevention" | "contractor" | "captain";
  moment: "before" | "on_arrival" | "on_finish";
  requiresSignature: boolean;
  mandatory: boolean;
  fixed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Serializa fila + conteos → listado. */
function toListItem(row: FlowWithCounts): ApprovalFlowListItem {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    copiedFromId: row.copiedFromId,
    active: row.active,
    stageCount: row._count.stages,
    typeCount: row._count.permitTypes,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Serializa etapa. */
function toStageResponse(row: StageRow) {
  return {
    id: row.id,
    flowId: row.flowId,
    position: row.position,
    key: row.key,
    label: row.label,
    actor: row.actor,
    moment: row.moment,
    requiresSignature: row.requiresSignature,
    mandatory: row.mandatory,
    fixed: row.fixed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Detalle = list item + stages. */
function toDetail(
  row: FlowWithCounts & { stages: StageRow[] },
): ApprovalFlowDetail {
  return {
    ...toListItem(row),
    stages: row.stages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toStageResponse),
  };
}

/**
 * Filtro de listado: Superadmin ve todas (o filtra businessId);
 * resto solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListApprovalFlowsQuery,
): Prisma.ApprovalFlowWhereInput {
  const base: Prisma.ApprovalFlowWhereInput = { deletedAt: null };

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
      "Usuario sin empresa asignada",
    );
  }

  return { ...base, businessId: actor.businessId };
}

/** Include estándar de detalle/listado. */
const flowListInclude = {
  _count: { select: { stages: true, permitTypes: true } },
} as const;

const flowDetailInclude = {
  ...flowListInclude,
  stages: { orderBy: { position: "asc" as const } },
};

/** GET listado paginado de flujos de aprobación. */
export async function listApprovalFlows(
  actor: Actor,
  query: ListApprovalFlowsQuery,
): Promise<{
  items: ApprovalFlowListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.approvalFlow.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      skip,
      take: query.limit,
      include: flowListInclude,
    }),
    prisma.approvalFlow.count({ where }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** ¿El actor puede ver este businessId? */
function assertCanAccessBusiness(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (actor.businessId !== businessId) {
    throw new AppError(403, "forbidden", "Fuera de tu empresa");
  }
}

/** GET detalle con etapas. */
export async function getApprovalFlowById(
  actor: Actor,
  id: string,
): Promise<ApprovalFlowDetail> {
  const row = await prisma.approvalFlow.findFirst({
    where: { id, deletedAt: null },
    include: flowDetailInclude,
  });
  if (!row) {
    throw new AppError(404, "approval_flow_not_found", "Flujo no encontrado");
  }
  assertCanAccessBusiness(actor, row.businessId);
  return toDetail(row);
}

/**
 * POST: crea copia editable (P16m).
 * Copia etapas del origen (EST por defecto); isSystem=false.
 */
export async function createApprovalFlow(
  actor: Actor,
  body: CreateApprovalFlowBody,
): Promise<ApprovalFlowDetail> {
  assertCanAccessBusiness(actor, body.businessId);

  const business = await prisma.business.findFirst({
    where: { id: body.businessId, deletedAt: null },
    select: { id: true },
  });
  if (!business) {
    throw new AppError(404, "business_not_found", "Empresa no encontrada");
  }

  const source = body.sourceFlowId
    ? await prisma.approvalFlow.findFirst({
        where: {
          id: body.sourceFlowId,
          businessId: body.businessId,
          deletedAt: null,
        },
        include: { stages: { orderBy: { position: "asc" } } },
      })
    : await prisma.approvalFlow.findFirst({
        where: {
          businessId: body.businessId,
          code: "EST",
          deletedAt: null,
        },
        include: { stages: { orderBy: { position: "asc" } } },
      });

  if (!source) {
    throw new AppError(
      404,
      "source_flow_not_found",
      "Flujo origen no encontrado (sembrá EST primero)",
    );
  }

  if (source.stages.length > MAX_APPROVAL_FLOW_STAGES) {
    throw new AppError(
      400,
      "validation_error",
      `El origen tiene más de ${MAX_APPROVAL_FLOW_STAGES} etapas`,
    );
  }

  if (source.stages.length === 0) {
    throw new AppError(
      400,
      "validation_error",
      "El flujo origen no tiene etapas para copiar",
    );
  }

  const duplicateCode = await prisma.approvalFlow.findFirst({
    where: {
      businessId: body.businessId,
      code: body.code,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (duplicateCode) {
    throw new AppError(
      409,
      "duplicate_approval_flow",
      `Ya existe un flujo con código ${body.code}`,
    );
  }

  /** Cantidad pedida; por defecto todas las del origen. */
  const targetCount = body.stageCount ?? source.stages.length;
  if (targetCount < 1 || targetCount > MAX_APPROVAL_FLOW_STAGES) {
    throw new AppError(
      400,
      "validation_error",
      `stageCount debe estar entre 1 y ${MAX_APPROVAL_FLOW_STAGES}`,
    );
  }

  const fromSource = source.stages.slice(
    0,
    Math.min(targetCount, source.stages.length),
  );
  type StageCreate = {
    position: number;
    key: string;
    label: string;
    actor: (typeof fromSource)[number]["actor"];
    moment: (typeof fromSource)[number]["moment"];
    requiresSignature: boolean;
    mandatory: boolean;
    fixed: boolean;
  };
  const stagesToCreate: StageCreate[] = fromSource.map((s, idx) => ({
    position: idx + 1,
    key: s.key,
    label: s.label,
    actor: s.actor,
    moment: s.moment,
    requiresSignature: s.requiresSignature,
    mandatory: s.mandatory,
    /** Copia personalizada: todas editables (solo EST sistema es fijo). */
    fixed: false,
  }));

  /** Rellena hasta targetCount con etapas editables. */
  for (let i = stagesToCreate.length; i < targetCount; i += 1) {
    const position = i + 1;
    stagesToCreate.push({
      position,
      key: `custom_${position}`,
      label: `Etapa ${position} (completar)`,
      actor: "prevention",
      moment: "before",
      requiresSignature: false,
      mandatory: true,
      fixed: false,
    });
  }

  try {
    const created = await prisma.approvalFlow.create({
      data: {
        businessId: body.businessId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        isSystem: false,
        copiedFromId: source.id,
        active: true,
        stages: {
          create: stagesToCreate,
        },
      },
      include: flowDetailInclude,
    });
    return toDetail(created);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_approval_flow",
        `Ya existe un flujo con código ${body.code}`,
      );
    }
    throw err;
  }
}

/**
 * Carga un flujo editable (no sistema) o lanza.
 * Devuelve la fila con stages para mutaciones.
 */
async function loadEditableFlow(actor: Actor, id: string) {
  const row = await prisma.approvalFlow.findFirst({
    where: { id, deletedAt: null },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!row) {
    throw new AppError(404, "approval_flow_not_found", "Flujo no encontrado");
  }
  assertCanAccessBusiness(actor, row.businessId);
  if (row.isSystem) {
    throw new AppError(
      400,
      "system_flow_readonly",
      "El flujo de sistema no se puede editar; duplicálo primero",
    );
  }
  return row;
}

/** Relee detalle completo tras mutar. */
async function reloadDetail(id: string): Promise<ApprovalFlowDetail> {
  const row = await prisma.approvalFlow.findFirstOrThrow({
    where: { id },
    include: flowDetailInclude,
  });
  return toDetail(row);
}

/** Renumera posiciones 1..n en orden actual. */
async function renumberStages(flowId: string): Promise<void> {
  const stages = await prisma.approvalFlowStage.findMany({
    where: { flowId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (let i = 0; i < stages.length; i += 1) {
    await prisma.approvalFlowStage.update({
      where: { id: stages[i]!.id },
      data: { position: i + 1 },
    });
  }
}

/** PATCH flujo: nombre, descripción, activo. */
export async function updateApprovalFlow(
  actor: Actor,
  id: string,
  body: UpdateApprovalFlowBody,
): Promise<ApprovalFlowDetail> {
  await loadEditableFlow(actor, id);

  await prisma.approvalFlow.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  return reloadDetail(id);
}

/** POST etapa extra al final (máx. 8). */
export async function addApprovalFlowStage(
  actor: Actor,
  flowId: string,
  body: CreateApprovalFlowStageBody,
): Promise<ApprovalFlowDetail> {
  const flow = await loadEditableFlow(actor, flowId);

  if (flow.stages.length >= MAX_APPROVAL_FLOW_STAGES) {
    throw new AppError(
      400,
      "max_stages_reached",
      `Máximo ${MAX_APPROVAL_FLOW_STAGES} etapas por flujo`,
    );
  }

  const keyTaken = flow.stages.some((s) => s.key === body.key);
  if (keyTaken) {
    throw new AppError(
      409,
      "duplicate_stage_key",
      `Ya existe una etapa con clave ${body.key}`,
    );
  }

  const position = flow.stages.length + 1;

  try {
    await prisma.approvalFlowStage.create({
      data: {
        flowId,
        position,
        key: body.key,
        label: body.label,
        actor: body.actor,
        moment: body.moment,
        requiresSignature: body.requiresSignature,
        mandatory: body.mandatory,
        fixed: false,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_stage_key",
        `Ya existe una etapa con clave ${body.key}`,
      );
    }
    throw err;
  }

  return reloadDetail(flowId);
}

/** PATCH etapa (también las fijas de una copia personalizada). */
export async function updateApprovalFlowStage(
  actor: Actor,
  flowId: string,
  stageId: string,
  body: UpdateApprovalFlowStageBody,
): Promise<ApprovalFlowDetail> {
  const flow = await loadEditableFlow(actor, flowId);
  const stage = flow.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new AppError(404, "stage_not_found", "Etapa no encontrada");
  }

  await prisma.approvalFlowStage.update({
    where: { id: stageId },
    data: {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.actor !== undefined ? { actor: body.actor } : {}),
      ...(body.moment !== undefined ? { moment: body.moment } : {}),
      ...(body.requiresSignature !== undefined
        ? { requiresSignature: body.requiresSignature }
        : {}),
      ...(body.mandatory !== undefined ? { mandatory: body.mandatory } : {}),
    },
  });

  return reloadDetail(flowId);
}

/**
 * Soft-delete de un flujo personalizado.
 * Desasigna tipos que lo tenían como default; EST sistema no se borra.
 */
export async function deleteApprovalFlow(
  actor: Actor,
  id: string,
): Promise<ApprovalFlowDetail> {
  await loadEditableFlow(actor, id);

  await prisma.$transaction([
    prisma.permitType.updateMany({
      where: { defaultApprovalFlowId: id },
      data: { defaultApprovalFlowId: null },
    }),
    prisma.approvalFlow.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    }),
  ]);

  return reloadDetail(id);
}

/** DELETE etapa no fija; renumera posiciones. */
export async function deleteApprovalFlowStage(
  actor: Actor,
  flowId: string,
  stageId: string,
): Promise<ApprovalFlowDetail> {
  const flow = await loadEditableFlow(actor, flowId);
  const stage = flow.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new AppError(404, "stage_not_found", "Etapa no encontrada");
  }
  /**
   * En flujos personalizados se puede quitar cualquier etapa
   * (incluidas las que vinieron marcadas fixed al copiar EST viejo).
   * EST sistema no llega acá (loadEditableFlow lo bloquea).
   */
  if (flow.stages.length <= 1) {
    throw new AppError(
      400,
      "validation_error",
      "El flujo debe conservar al menos una etapa",
    );
  }

  await prisma.approvalFlowStage.delete({ where: { id: stageId } });
  await renumberStages(flowId);
  return reloadDetail(flowId);
}
