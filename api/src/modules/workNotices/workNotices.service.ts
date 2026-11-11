import { Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import {
  applyDataScopeToWhere,
  assertDataScopeAccess,
} from "../../lib/dataScope.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateWorkNoticeBody,
  ListWorkNoticesQuery,
  WorkNoticeResponse,
} from "./workNotices.schemas.js";

/** Actor con id, tenant y dataScope (nave/área). */
type Actor = Pick<
  AuthUser,
  | "id"
  | "internalRol"
  | "businessId"
  | "locationId"
  | "areaId"
  | "organizationId"
  | "dataScope"
>;

/** Include de relaciones para serializar el aviso. */
const noticeInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      rut: true,
      deletedAt: true,
      businessId: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      accreditations: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { status: true },
      },
    },
  },
  permitType: { select: { id: true, code: true, name: true, businessId: true, deletedAt: true, active: true } },
  location: { select: { id: true, name: true, businessId: true, deletedAt: true, state: true } },
  requestingArea: { select: { id: true, name: true, businessId: true, deletedAt: true } },
  workPermit: { select: { id: true, code: true, status: true, deletedAt: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

/** Fila Prisma con include. */
type NoticeRow = Prisma.WorkNoticeGetPayload<{ include: typeof noticeInclude }>;

/** YYYY-MM-DD desde Date (columna @db.Date). */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parsea tentativeDate del body a Date UTC midnight. */
function parseTentativeDate(raw: string): Date {
  const day = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new AppError(
      400,
      "invalid_tentative_date",
      "Fecha tentativa inválida (usá YYYY-MM-DD)",
    );
  }
  const d = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(
      400,
      "invalid_tentative_date",
      "Fecha tentativa inválida",
    );
  }
  return d;
}

/** Serializa aviso → contrato Zod. */
function toWorkNoticeResponse(row: NoticeRow): WorkNoticeResponse {
  const latest = row.organization.accreditations[0]?.status ?? null;
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    organizationId: row.organizationId,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      rut: row.organization.rut,
      latestAccreditationStatus: latest,
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
    requestingAreaId: row.requestingAreaId,
    requestingArea: {
      id: row.requestingArea.id,
      name: row.requestingArea.name,
    },
    tentativeDate: toDateOnly(row.tentativeDate),
    estimatedDurationDays: row.estimatedDurationDays,
    description: row.description,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    notifyByEmail: row.notifyByEmail,
    status: row.status,
    workPermit:
      row.workPermit && !row.workPermit.deletedAt
        ? {
            id: row.workPermit.id,
            code: row.workPermit.code,
            status: row.workPermit.status,
          }
        : null,
    createdById: row.createdById,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          firstName: row.createdBy.firstName,
          lastName: row.createdBy.lastName,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 404/403 si el actor no puede ver el aviso
 * (empresa + nave/área según dataScope).
 */
function assertNoticeTenantAccess(
  actor: Actor,
  row: {
    businessId: string;
    locationId?: string | null;
    requestingAreaId?: string | null;
  },
): void {
  assertDataScopeAccess(
    actor,
    {
      businessId: row.businessId,
      locationId: row.locationId,
      areaId: row.requestingAreaId,
    },
    { code: "work_notice_not_found", message: "Aviso no encontrado" },
  );
}

/** Where de listado con tenant + dataScope + filtros. */
function listWhere(
  actor: Actor,
  query: ListWorkNoticesQuery,
): Prisma.WorkNoticeWhereInput {
  const base: Prisma.WorkNoticeWhereInput = { deletedAt: null };

  if (query.status) base.status = query.status;
  if (query.organizationId) base.organizationId = query.organizationId;

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
        organization: {
          rut: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    if (query.businessId) return { ...base, businessId: query.businessId };
    return base;
  }

  return applyDataScopeToWhere(actor, base, {
    locationField: "locationId",
    areaField: "requestingAreaId",
  });
}

/**
 * Genera AV-NNNN (global, 4 dígitos).
 * Escaneo por prefijo AV-; si no hay, empieza en 1.
 */
async function nextWorkNoticeCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const last = await tx.workNotice.findFirst({
    where: { code: { startsWith: "AV-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const match = /^AV-(\d+)$/.exec(last.code);
    if (match) next = Number(match[1]) + 1;
  }
  return `AV-${String(next).padStart(4, "0")}`;
}

/** Normaliza email vacío → null; valida formato si viene. */
function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new AppError(400, "invalid_contact_email", "Email de contacto inválido");
  }
  return v;
}

/** GET /work-notices — bandeja AT1. */
export async function listWorkNotices(
  actor: Actor,
  query: ListWorkNoticesQuery,
): Promise<{
  items: WorkNoticeResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.workNotice.findMany({
      where,
      include: noticeInclude,
      orderBy: [{ tentativeDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.workNotice.count({ where }),
  ]);

  return {
    items: rows.map(toWorkNoticeResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** GET /work-notices/:id. */
export async function getWorkNoticeById(
  actor: Actor,
  id: string,
): Promise<WorkNoticeResponse> {
  const row = await prisma.workNotice.findFirst({
    where: { id, deletedAt: null },
    include: noticeInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(404, "work_notice_not_found", "Aviso no encontrado");
  }
  assertNoticeTenantAccess(actor, row);
  return toWorkNoticeResponse(row);
}

/**
 * POST /work-notices — área solicitante envía aviso (AT2).
 * Requiere User.areaId (sin área no se generan avisos).
 * Org, tipo y nave del mismo tenant; módulo work_permits on.
 */
export async function createWorkNotice(
  actor: Actor,
  body: CreateWorkNoticeBody,
): Promise<WorkNoticeResponse> {
  // Área solicitante = área del usuario al momento de crear (no se elige en el form).
  const actorRow = await prisma.user.findFirst({
    where: { id: actor.id, deletedAt: null },
    select: { areaId: true },
  });
  if (!actorRow?.areaId) {
    throw new AppError(
      400,
      "area_required",
      "Tu usuario no tiene un área asignada; no podés generar avisos de trabajo",
    );
  }

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
  // Solo empresa aquí; nave se valida al cargar location.
  if (
    actor.internalRol !== "superadmin" &&
    actor.dataScope !== "all" &&
    (!actor.businessId || actor.businessId !== org.businessId)
  ) {
    throw new AppError(
      400,
      "contractor_not_found",
      "Organización contratista no encontrada o inactiva",
    );
  }
  await assertBusinessModuleEnabled(org.businessId, "work_permits");

  const requestingArea = await prisma.area.findFirst({
    where: {
      id: actorRow.areaId,
      deletedAt: null,
      state: true,
      businessId: org.businessId,
    },
  });
  if (!requestingArea) {
    throw new AppError(
      400,
      "area_not_found",
      "El área de tu usuario no está activa en esta empresa",
    );
  }

  const permitType = await prisma.permitType.findFirst({
    where: {
      id: body.permitTypeId,
      deletedAt: null,
      active: true,
      businessId: org.businessId,
    },
  });
  if (!permitType) {
    throw new AppError(
      400,
      "permit_type_not_found",
      "Tipo de permiso no encontrado o inactivo",
    );
  }

  const location = await prisma.location.findFirst({
    where: {
      id: body.locationId,
      deletedAt: null,
      state: true,
      businessId: org.businessId,
    },
  });
  if (!location) {
    throw new AppError(
      400,
      "location_not_found",
      "Nave/lugar no encontrado o inactivo",
    );
  }
  assertNoticeTenantAccess(actor, {
    businessId: org.businessId,
    locationId: location.id,
    requestingAreaId: requestingArea.id,
  });

  const tentativeDate = parseTentativeDate(body.tentativeDate);
  const contactEmail = normalizeEmail(body.contactEmail);
  const contactName =
    body.contactName?.trim() || org.contactName || null;
  const contactPhone =
    body.contactPhone?.trim() || org.contactPhone || null;
  const resolvedEmail = contactEmail ?? org.contactEmail ?? null;

  const created = await prisma.$transaction(async (tx) => {
    const code = await nextWorkNoticeCode(tx);
    return tx.workNotice.create({
      data: {
        businessId: org.businessId,
        code,
        organizationId: org.id,
        permitTypeId: permitType.id,
        locationId: location.id,
        requestingAreaId: requestingArea.id,
        tentativeDate,
        estimatedDurationDays:
          body.estimatedDurationDays === undefined
            ? null
            : body.estimatedDurationDays,
        description: body.description?.trim() || null,
        contactName,
        contactEmail: resolvedEmail,
        contactPhone,
        // Siempre avisa a Prevención: ella valida docs y habilita el trabajo.
        notifyByEmail: true,
        status: "pending",
        createdById: actor.id,
      },
      include: noticeInclude,
    });
  });

  return toWorkNoticeResponse(created);
}

/**
 * DELETE /work-notices/:id — soft-delete del aviso.
 * Si tiene PT vinculado, también lo soft-deletea (limpia la bandeja).
 */
export async function deleteWorkNoticeById(
  actor: Actor,
  id: string,
): Promise<WorkNoticeResponse> {
  const row = await prisma.workNotice.findFirst({
    where: { id, deletedAt: null },
    include: noticeInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(404, "work_notice_not_found", "Aviso no encontrado");
  }
  assertNoticeTenantAccess(actor, row);
  await assertBusinessModuleEnabled(row.businessId, "work_permits");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (row.workPermit && !row.workPermit.deletedAt) {
      await tx.workPermit.update({
        where: { id: row.workPermit.id },
        data: { deletedAt: now },
      });
    }
    return tx.workNotice.update({
      where: { id: row.id },
      data: { deletedAt: now, status: "cancelled" },
      include: noticeInclude,
    });
  });

  return toWorkNoticeResponse(updated);
}
