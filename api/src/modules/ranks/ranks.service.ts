import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateRankBody,
  ListRanksQuery,
  RankResponse,
  UpdateRankBody,
} from "./ranks.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toRankResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RankResponse {
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
  query: ListRanksQuery,
): Prisma.RankWhereInput {
  const base: Prisma.RankWhereInput = { deletedAt: null };

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
function resolveCreateBusinessId(actor: Actor, body: CreateRankBody): string {
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
      "businessId es requerido para crear un rango",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertRankTenantAccess(actor: Actor, rankBusinessId: string): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== rankBusinessId) {
    throw new AppError(404, "rank_not_found", "Rango no encontrado");
  }
}

/** Lista rangos visibles para el actor (paginado). */
export async function listRanks(
  actor: Actor,
  query: ListRanksQuery,
): Promise<{
  items: RankResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.rank.count({ where }),
    prisma.rank.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toRankResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getRankById(
  actor: Actor,
  id: string,
): Promise<RankResponse> {
  const row = await prisma.rank.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "rank_not_found", "Rango no encontrado");
  }
  assertRankTenantAccess(actor, row.businessId);
  return toRankResponse(row);
}

/**
 * Crea rango (admin o superadmin).
 * Nombre único por empresa entre no borrados.
 */
export async function createRank(
  actor: Actor,
  body: CreateRankBody,
): Promise<RankResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.rank.create({
      data: {
        name: body.name,
        businessId,
        state: body.state ?? true,
      },
    });
    return toRankResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_rank_name",
        "El nombre del rango ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza rango. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateRank(
  actor: Actor,
  id: string,
  payload: UpdateRankBody,
): Promise<RankResponse> {
  const existing = await prisma.rank.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "rank_not_found", "Rango no encontrado");
  }
  assertRankTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el rango a otra empresa",
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

  const data: Prisma.RankUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.rank.update({
      where: { id },
      data,
    });
    return toRankResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_rank_name",
        "El nombre del rango ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMember (S7), rechazar si hay tripulantes activos con ese rankId.
 */
export async function deleteRankById(
  actor: Actor,
  id: string,
): Promise<RankResponse> {
  const rank = await prisma.rank.findFirst({
    where: { id, deletedAt: null },
  });
  if (!rank) {
    throw new AppError(404, "rank_not_found", "Rango no encontrado");
  }
  assertRankTenantAccess(actor, rank.businessId);

  const updated = await prisma.rank.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toRankResponse(updated);
}
