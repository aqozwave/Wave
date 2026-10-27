import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  AcademicDegreeResponse,
  CreateAcademicDegreeBody,
  ListAcademicDegreesQuery,
  UpdateAcademicDegreeBody,
} from "./academicDegrees.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toAcademicDegreeResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AcademicDegreeResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    businessId: row.businessId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado: superadmin ve todas (o filtra por businessId);
 * admin/user solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListAcademicDegreesQuery,
): Prisma.AcademicDegreeWhereInput {
  const base: Prisma.AcademicDegreeWhereInput = { deletedAt: null };

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
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateAcademicDegreeBody,
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
      "businessId es requerido para crear un título",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertDegreeTenantAccess(
  actor: Actor,
  degreeBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== degreeBusinessId) {
    throw new AppError(404, "academic_degree_not_found", "Título no encontrado");
  }
}

/** Lista títulos visibles para el actor (paginado). */
export async function listAcademicDegrees(
  actor: Actor,
  query: ListAcademicDegreesQuery,
): Promise<{
  items: AcademicDegreeResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.academicDegree.count({ where }),
    prisma.academicDegree.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toAcademicDegreeResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getAcademicDegreeById(
  actor: Actor,
  id: string,
): Promise<AcademicDegreeResponse> {
  const row = await prisma.academicDegree.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "academic_degree_not_found", "Título no encontrado");
  }
  assertDegreeTenantAccess(actor, row.businessId);
  return toAcademicDegreeResponse(row);
}

/**
 * Crea título (admin o superadmin).
 * Nombre único por empresa entre no borrados.
 */
export async function createAcademicDegree(
  actor: Actor,
  body: CreateAcademicDegreeBody,
): Promise<AcademicDegreeResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.academicDegree.create({
      data: {
        name: body.name,
        businessId,
        state: body.state ?? true,
      },
    });
    return toAcademicDegreeResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_academic_degree_name",
        "El nombre del título ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza título. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateAcademicDegree(
  actor: Actor,
  id: string,
  payload: UpdateAcademicDegreeBody,
): Promise<AcademicDegreeResponse> {
  const existing = await prisma.academicDegree.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "academic_degree_not_found", "Título no encontrado");
  }
  assertDegreeTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el título a otra empresa",
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

  const data: Prisma.AcademicDegreeUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.academicDegree.update({
      where: { id },
      data,
    });
    return toAcademicDegreeResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_academic_degree_name",
        "El nombre del título ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMember (S7), rechazar si hay tripulantes activos con ese academicDegreeId.
 */
export async function deleteAcademicDegreeById(
  actor: Actor,
  id: string,
): Promise<AcademicDegreeResponse> {
  const degree = await prisma.academicDegree.findFirst({
    where: { id, deletedAt: null },
  });
  if (!degree) {
    throw new AppError(404, "academic_degree_not_found", "Título no encontrado");
  }
  assertDegreeTenantAccess(actor, degree.businessId);

  const updated = await prisma.academicDegree.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toAcademicDegreeResponse(updated);
}
