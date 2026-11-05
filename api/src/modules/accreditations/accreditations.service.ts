import type { AccreditationStatus, Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  AccreditationResponse,
  AccreditationReviewNoteBody,
  CreateAccreditationBody,
  ListAccreditationsQuery,
} from "./accreditations.schemas.js";

/** Actor con id para auditoría de solicitud/revisión. */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

/** Include de org en lecturas (deletedAt para filtrar soft-delete). */
const organizationInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      rut: true,
      businessId: true,
      deletedAt: true,
    },
  },
} as const;

/** Serializa fila → contrato Zod. */
function toAccreditationResponse(row: {
  id: string;
  code: string;
  organizationId: string;
  status: AccreditationStatus;
  message: string | null;
  reviewNote: string | null;
  requestedAt: Date | null;
  requestedById: string | null;
  dueAt: Date | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    rut: string;
    businessId: string;
    deletedAt?: Date | null;
  };
}): AccreditationResponse {
  return {
    id: row.id,
    code: row.code,
    organizationId: row.organizationId,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      rut: row.organization.rut,
      businessId: row.organization.businessId,
    },
    status: row.status,
    message: row.message,
    reviewNote: row.reviewNote,
    requestedAt: row.requestedAt ? row.requestedAt.toISOString() : null,
    requestedById: row.requestedById,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedById: row.reviewedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro listado: admin/prevencionista → su business vía org;
 * superadmin puede filtrar businessId.
 */
function listWhere(
  actor: Actor,
  query: ListAccreditationsQuery,
): Prisma.ContractorAccreditationWhereInput {
  const base: Prisma.ContractorAccreditationWhereInput = {};

  if (query.status) base.status = query.status;
  if (query.organizationId) base.organizationId = query.organizationId;

  if (query.search && query.search.length > 0) {
    base.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      {
        organization: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        organization: {
          rut: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (actor.internalRol === "superadmin") {
    if (query.businessId) {
      return {
        ...base,
        organization: { businessId: query.businessId, deletedAt: null },
      };
    }
    return {
      ...base,
      organization: { deletedAt: null },
    };
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  return {
    ...base,
    organization: { businessId: actor.businessId, deletedAt: null },
  };
}

/** 404 si la HAB no es del tenant del actor. */
function assertAccreditationTenantAccess(
  actor: Actor,
  orgBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== orgBusinessId) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
}

/**
 * Genera el próximo código HAB-NNNN (global, 4 dígitos).
 * Escaneo por prefijo HAB-; si no hay, empieza en 1.
 */
async function nextAccreditationCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const last = await tx.contractorAccreditation.findFirst({
    where: { code: { startsWith: "HAB-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const match = /^HAB-(\d+)$/.exec(last.code);
    if (match) next = Number(match[1]) + 1;
  }
  return `HAB-${String(next).padStart(4, "0")}`;
}

/** Estados que bloquean una nueva solicitud sobre la misma org. */
const OPEN_STATUSES: AccreditationStatus[] = [
  "invited",
  "pending",
  "in_review",
  "observed",
];

/** Lista habilitaciones visibles. */
export async function listAccreditations(
  actor: Actor,
  query: ListAccreditationsQuery,
): Promise<{
  items: AccreditationResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.contractorAccreditation.findMany({
      where,
      include: organizationInclude,
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.contractorAccreditation.count({ where }),
  ]);

  return {
    items: rows.map(toAccreditationResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id. */
export async function getAccreditationById(
  actor: Actor,
  id: string,
): Promise<AccreditationResponse> {
  const row = await prisma.contractorAccreditation.findFirst({
    where: { id },
    include: organizationInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertAccreditationTenantAccess(actor, row.organization.businessId);
  return toAccreditationResponse(row);
}

/** Solicitar documentación → HAB en pending. */
export async function createAccreditation(
  actor: Actor,
  body: CreateAccreditationBody,
): Promise<AccreditationResponse> {
  const org = await prisma.contractorOrganization.findFirst({
    where: { id: body.organizationId, deletedAt: null, active: true },
  });
  if (!org) {
    throw new AppError(
      400,
      "contractor_not_found",
      "Organización contratista no encontrada o inactiva",
    );
  }
  assertAccreditationTenantAccess(actor, org.businessId);
  await assertBusinessModuleEnabled(org.businessId, "contractors");

  const open = await prisma.contractorAccreditation.findFirst({
    where: {
      organizationId: org.id,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true, code: true, status: true },
  });
  if (open) {
    throw new AppError(
      409,
      "accreditation_already_open",
      `Ya hay una habilitación abierta (${open.code}, ${open.status})`,
    );
  }

  const dueAt =
    body.dueAt === undefined || body.dueAt === null
      ? null
      : new Date(body.dueAt);
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    throw new AppError(400, "validation_error", "dueAt inválido");
  }

  const row = await prisma.$transaction(async (tx) => {
    const code = await nextAccreditationCode(tx);
    return tx.contractorAccreditation.create({
      data: {
        code,
        organizationId: org.id,
        status: "pending",
        message: body.message?.trim() || null,
        dueAt,
        requestedAt: new Date(),
        requestedById: actor.id,
      },
      include: organizationInclude,
    });
  });

  return toAccreditationResponse(row);
}

/** Contratista (o staff) envía a revisión: pending|observed → in_review. */
export async function submitAccreditation(
  actor: Actor,
  id: string,
): Promise<AccreditationResponse> {
  const existing = await prisma.contractorAccreditation.findFirst({
    where: { id },
    include: organizationInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertAccreditationTenantAccess(actor, existing.organization.businessId);
  await assertBusinessModuleEnabled(
    existing.organization.businessId,
    "contractors",
  );

  if (existing.status !== "pending" && existing.status !== "observed") {
    throw new AppError(
      409,
      "invalid_accreditation_transition",
      `No se puede enviar a revisión desde estado ${existing.status}`,
    );
  }

  const updated = await prisma.contractorAccreditation.update({
    where: { id },
    data: {
      status: "in_review",
      submittedAt: new Date(),
      reviewNote: null,
    },
    include: organizationInclude,
  });
  return toAccreditationResponse(updated);
}

/** Prevención aprueba: in_review → approved. */
export async function approveAccreditation(
  actor: Actor,
  id: string,
): Promise<AccreditationResponse> {
  const existing = await prisma.contractorAccreditation.findFirst({
    where: { id },
    include: organizationInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertAccreditationTenantAccess(actor, existing.organization.businessId);
  await assertBusinessModuleEnabled(
    existing.organization.businessId,
    "contractors",
  );

  if (existing.status !== "in_review") {
    throw new AppError(
      409,
      "invalid_accreditation_transition",
      `Solo se aprueba desde in_review (ahora: ${existing.status})`,
    );
  }

  const updated = await prisma.contractorAccreditation.update({
    where: { id },
    data: {
      status: "approved",
      reviewedAt: new Date(),
      reviewedById: actor.id,
      reviewNote: null,
    },
    include: organizationInclude,
  });
  return toAccreditationResponse(updated);
}

/** Devuelve con observaciones: in_review → observed. */
export async function returnAccreditation(
  actor: Actor,
  id: string,
  body: AccreditationReviewNoteBody,
): Promise<AccreditationResponse> {
  const existing = await prisma.contractorAccreditation.findFirst({
    where: { id },
    include: organizationInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertAccreditationTenantAccess(actor, existing.organization.businessId);
  await assertBusinessModuleEnabled(
    existing.organization.businessId,
    "contractors",
  );

  if (existing.status !== "in_review") {
    throw new AppError(
      409,
      "invalid_accreditation_transition",
      `Solo se devuelve desde in_review (ahora: ${existing.status})`,
    );
  }

  const updated = await prisma.contractorAccreditation.update({
    where: { id },
    data: {
      status: "observed",
      reviewNote: body.reviewNote,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    },
    include: organizationInclude,
  });
  return toAccreditationResponse(updated);
}

/** Rechaza: in_review → rejected. */
export async function rejectAccreditation(
  actor: Actor,
  id: string,
  body: AccreditationReviewNoteBody,
): Promise<AccreditationResponse> {
  const existing = await prisma.contractorAccreditation.findFirst({
    where: { id },
    include: organizationInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertAccreditationTenantAccess(actor, existing.organization.businessId);
  await assertBusinessModuleEnabled(
    existing.organization.businessId,
    "contractors",
  );

  if (existing.status !== "in_review") {
    throw new AppError(
      409,
      "invalid_accreditation_transition",
      `Solo se rechaza desde in_review (ahora: ${existing.status})`,
    );
  }

  const updated = await prisma.contractorAccreditation.update({
    where: { id },
    data: {
      status: "rejected",
      reviewNote: body.reviewNote,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    },
    include: organizationInclude,
  });
  return toAccreditationResponse(updated);
}
