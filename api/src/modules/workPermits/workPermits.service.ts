import { Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateWorkPermitBody,
  ListWorkPermitsQuery,
  WorkPermitResponse,
} from "./workPermits.schemas.js";

/** Actor con id, tenant y org (portal contratista). */
type Actor = Pick<
  AuthUser,
  "id" | "internalRol" | "businessId" | "organizationId"
>;

/** Include para serializar PT. */
const permitInclude = {
  workNotice: { select: { id: true, code: true, status: true, deletedAt: true } },
  organization: {
    select: { id: true, name: true, rut: true, deletedAt: true },
  },
  permitType: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, name: true } },
} as const;

type PermitRow = Prisma.WorkPermitGetPayload<{ include: typeof permitInclude }>;

/** YYYY-MM-DD. */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Serializa PT → contrato. */
function toWorkPermitResponse(row: PermitRow): WorkPermitResponse {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    workNoticeId: row.workNoticeId,
    workNotice: {
      id: row.workNotice.id,
      code: row.workNotice.code,
    },
    organizationId: row.organizationId,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      rut: row.organization.rut,
    },
    permitTypeId: row.permitTypeId,
    permitType: {
      id: row.permitType.id,
      code: row.permitType.code,
      name: row.permitType.name,
    },
    locationId: row.locationId,
    location: {
      id: row.location.id,
      name: row.location.name,
    },
    scheduledDate: toDateOnly(row.scheduledDate),
    description: row.description,
    status: row.status,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Acceso a un PT: superadmin OK; contratista solo su org;
 * staff solo su businessId.
 */
function assertPermitAccess(
  actor: Actor,
  row: { businessId: string; organizationId: string },
): void {
  if (actor.internalRol === "superadmin") return;
  if (actor.organizationId) {
    if (actor.organizationId !== row.organizationId) {
      throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
    }
    return;
  }
  if (!actor.businessId || actor.businessId !== row.businessId) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
}

/** Where listado (contratista acotado a su org). */
function listWhere(
  actor: Actor,
  query: ListWorkPermitsQuery,
): Prisma.WorkPermitWhereInput {
  const base: Prisma.WorkPermitWhereInput = { deletedAt: null };

  if (query.status) base.status = query.status;

  if (query.search && query.search.length > 0) {
    base.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      {
        organization: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        workNotice: { code: { contains: query.search, mode: "insensitive" } },
      },
    ];
  }

  // Portal contratista: solo su organización.
  if (actor.organizationId) {
    return { ...base, organizationId: actor.organizationId };
  }

  if (query.organizationId) base.organizationId = query.organizationId;

  if (actor.internalRol === "superadmin") {
    if (query.businessId) return { ...base, businessId: query.businessId };
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

/** Genera PT-NNNN. */
async function nextWorkPermitCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const last = await tx.workPermit.findFirst({
    where: { code: { startsWith: "PT-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const match = /^PT-(\d+)$/.exec(last.code);
    if (match) next = Number(match[1]) + 1;
  }
  return `PT-${String(next).padStart(4, "0")}`;
}

/** GET /work-permits. */
export async function listWorkPermits(
  actor: Actor,
  query: ListWorkPermitsQuery,
): Promise<{
  items: WorkPermitResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.workPermit.findMany({
      where,
      include: permitInclude,
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.workPermit.count({ where }),
  ]);

  return {
    items: rows.map(toWorkPermitResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** GET /work-permits/:id. */
export async function getWorkPermitById(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  const row = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, row);
  return toWorkPermitResponse(row);
}

/**
 * POST /work-permits — Prevención crea el PT desde un aviso pending.
 * Marca el aviso como linked. Status inicial: to_complete.
 */
export async function createWorkPermitFromNotice(
  actor: Actor,
  body: CreateWorkPermitBody,
): Promise<WorkPermitResponse> {
  const notice = await prisma.workNotice.findFirst({
    where: { id: body.workNoticeId, deletedAt: null },
    include: {
      workPermit: { select: { id: true, code: true } },
      organization: { select: { id: true, deletedAt: true, active: true } },
    },
  });
  if (!notice || notice.organization.deletedAt) {
    throw new AppError(400, "work_notice_not_found", "Aviso no encontrado");
  }
  // Crear PT es acción de Prevención (staff), no del portal contratista.
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "El permiso lo crea Prevención desde el aviso",
    );
  }
  assertPermitAccess(actor, {
    businessId: notice.businessId,
    organizationId: notice.organizationId,
  });
  await assertBusinessModuleEnabled(notice.businessId, "work_permits");

  if (notice.status === "cancelled") {
    throw new AppError(
      400,
      "work_notice_cancelled",
      "El aviso está anulado; no se puede crear permiso",
    );
  }
  if (notice.workPermit) {
    throw new AppError(
      409,
      "work_permit_already_exists",
      `Este aviso ya tiene permiso ${notice.workPermit.code}`,
    );
  }
  if (!notice.organization.active) {
    throw new AppError(
      400,
      "contractor_inactive",
      "La organización está inactiva",
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const code = await nextWorkPermitCode(tx);
    const permit = await tx.workPermit.create({
      data: {
        businessId: notice.businessId,
        code,
        workNoticeId: notice.id,
        organizationId: notice.organizationId,
        permitTypeId: notice.permitTypeId,
        locationId: notice.locationId,
        scheduledDate: notice.tentativeDate,
        description:
          body.description === undefined
            ? notice.description
            : body.description?.trim() || null,
        status: "to_complete",
        createdById: actor.id,
      },
      include: permitInclude,
    });
    await tx.workNotice.update({
      where: { id: notice.id },
      data: { status: "linked" },
    });
    return permit;
  });

  return toWorkPermitResponse(created);
}

/**
 * POST /work-permits/:id/submit — contratista envía a aprobación.
 * to_complete → to_approve (E13).
 */
export async function submitWorkPermit(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_complete") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede enviar a aprobación desde estado ${existing.status}`,
    );
  }

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "to_approve" },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}
