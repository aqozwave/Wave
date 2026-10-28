import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateTravesiaBody,
  ListTravesiasQuery,
  TravesiaResponse,
  UpdateTravesiaBody,
} from "./travesias.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toTravesiaResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  requiredPassages: number;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TravesiaResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    requiredPassages: row.requiredPassages,
    businessId: row.businessId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado: superadmin ve todos (filtro businessId opcional);
 * admin/user solo los de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListTravesiasQuery,
): Prisma.TravesiaWhereInput {
  const base: Prisma.TravesiaWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return {
      ...base,
      ...(query.businessId ? { businessId: query.businessId } : {}),
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
  };
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateTravesiaBody,
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
      "businessId es requerido para crear una travesía",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertTravesiaTenantAccess(
  actor: Actor,
  travesiaBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== travesiaBusinessId) {
    throw new AppError(404, "travesia_not_found", "Travesía no encontrada");
  }
}

/** Lista travesías visibles para el actor (paginado). */
export async function listTravesias(
  actor: Actor,
  query: ListTravesiasQuery,
): Promise<{
  items: TravesiaResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.travesia.count({ where }),
    prisma.travesia.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toTravesiaResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getTravesiaById(
  actor: Actor,
  id: string,
): Promise<TravesiaResponse> {
  const row = await prisma.travesia.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "travesia_not_found", "Travesía no encontrada");
  }
  assertTravesiaTenantAccess(actor, row.businessId);
  return toTravesiaResponse(row);
}

/**
 * Crea travesía (admin o superadmin).
 * Único por empresa + nombre entre no borrados.
 */
export async function createTravesia(
  actor: Actor,
  body: CreateTravesiaBody,
): Promise<TravesiaResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.travesia.create({
      data: {
        name: body.name,
        requiredPassages: body.requiredPassages,
        businessId,
        state: body.state ?? true,
      },
    });
    return toTravesiaResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_travesia",
        "Ya existe una travesía con ese nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza travesía. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateTravesia(
  actor: Actor,
  id: string,
  payload: UpdateTravesiaBody,
): Promise<TravesiaResponse> {
  const existing = await prisma.travesia.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "travesia_not_found", "Travesía no encontrada");
  }
  assertTravesiaTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar la travesía a otra empresa",
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

  const data: Prisma.TravesiaUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.requiredPassages !== undefined) {
    data.requiredPassages = payload.requiredPassages;
  }
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.travesia.update({
      where: { id },
      data,
    });
    return toTravesiaResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_travesia",
        "Ya existe una travesía con ese nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Rechaza si hay asignaciones activas a tripulantes.
 */
export async function deleteTravesiaById(
  actor: Actor,
  id: string,
): Promise<TravesiaResponse> {
  const travesia = await prisma.travesia.findFirst({
    where: { id, deletedAt: null },
  });
  if (!travesia) {
    throw new AppError(404, "travesia_not_found", "Travesía no encontrada");
  }
  assertTravesiaTenantAccess(actor, travesia.businessId);

  const activeAssignments = await prisma.crewMemberTravesia.count({
    where: { travesiaId: id, deletedAt: null },
  });
  if (activeAssignments > 0) {
    throw new AppError(
      409,
      "travesia_in_use",
      `No se puede eliminar la travesía: tiene ${activeAssignments} asignación(es) a tripulantes`,
    );
  }

  const updated = await prisma.travesia.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toTravesiaResponse(updated);
}
