import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CompetencyCertificateResponse,
  CreateCompetencyCertificateBody,
  ListCompetencyCertificatesQuery,
  UpdateCompetencyCertificateBody,
} from "./competencyCertificates.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toCertificateResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  officerKind: "captain" | "first_pilot" | null;
  requiresMuelleTravesia: boolean;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CompetencyCertificateResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    businessId: row.businessId,
    officerKind: row.officerKind,
    requiresMuelleTravesia: row.requiresMuelleTravesia,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado: superadmin ve todas (filtros opcionales);
 * admin/user solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListCompetencyCertificatesQuery,
): Prisma.CompetencyCertificateWhereInput {
  const base: Prisma.CompetencyCertificateWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return {
      ...base,
      ...(query.businessId ? { businessId: query.businessId } : {}),
      ...(query.officerKind ? { officerKind: query.officerKind } : {}),
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
    businessId: actor.businessId,
    ...(query.officerKind ? { officerKind: query.officerKind } : {}),
  };
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateCompetencyCertificateBody,
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
      "businessId es requerido para crear un certificado",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertCertificateTenantAccess(
  actor: Actor,
  certificateBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== certificateBusinessId) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
}

/** Lista certificados visibles para el actor (paginado). */
export async function listCompetencyCertificates(
  actor: Actor,
  query: ListCompetencyCertificatesQuery,
): Promise<{
  items: CompetencyCertificateResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.competencyCertificate.count({ where }),
    prisma.competencyCertificate.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toCertificateResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getCompetencyCertificateById(
  actor: Actor,
  id: string,
): Promise<CompetencyCertificateResponse> {
  const row = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, row.businessId);
  return toCertificateResponse(row);
}

/**
 * Crea certificado (admin o superadmin).
 * Nombre único por empresa entre no borrados.
 */
export async function createCompetencyCertificate(
  actor: Actor,
  body: CreateCompetencyCertificateBody,
): Promise<CompetencyCertificateResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.competencyCertificate.create({
      data: {
        name: body.name,
        businessId,
        officerKind: body.officerKind ?? null,
        requiresMuelleTravesia: body.requiresMuelleTravesia ?? false,
        state: body.state ?? true,
      },
    });
    return toCertificateResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_competency_certificate_name",
        "El nombre del certificado ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza certificado. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateCompetencyCertificate(
  actor: Actor,
  id: string,
  payload: UpdateCompetencyCertificateBody,
): Promise<CompetencyCertificateResponse> {
  const existing = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el certificado a otra empresa",
        );
      }
    }
    const business = await prisma.business.findFirst({
      where: { id: payload.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "business_not_found", "Empresa no encontrada");
    }
    nextBusinessId = payload.businessId;
  }

  const data: Prisma.CompetencyCertificateUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (payload.officerKind !== undefined) data.officerKind = payload.officerKind;
  if (payload.requiresMuelleTravesia !== undefined) {
    data.requiresMuelleTravesia = payload.requiresMuelleTravesia;
  }
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.competencyCertificate.update({
      where: { id },
      data,
    });
    return toCertificateResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_competency_certificate_name",
        "El nombre del certificado ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMember (S7), rechazar si hay tripulantes activos con ese id.
 */
export async function deleteCompetencyCertificateById(
  actor: Actor,
  id: string,
): Promise<CompetencyCertificateResponse> {
  const cert = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!cert) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, cert.businessId);

  const updated = await prisma.competencyCertificate.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toCertificateResponse(updated);
}
