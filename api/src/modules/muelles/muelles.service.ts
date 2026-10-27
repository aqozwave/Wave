import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateMuelleBody,
  ListMuellesQuery,
  MuelleResponse,
  UpdateMuelleBody,
} from "./muelles.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Fila muelle con puerto incluido (para serializar portName). */
type MuelleWithPort = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  portId: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  port: { name: string };
};

/** Serializa fila Prisma → contrato Zod. */
function toMuelleResponse(row: MuelleWithPort): MuelleResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    portId: row.portId,
    portName: row.port.name,
    businessId: row.businessId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Include fijo del puerto para respuestas. */
const portInclude = { port: { select: { name: true } } } as const;

/**
 * Filtro de listado: superadmin ve todos (filtros opcionales);
 * admin/user solo los de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListMuellesQuery,
): Prisma.MuelleWhereInput {
  const base: Prisma.MuelleWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return {
      ...base,
      ...(query.businessId ? { businessId: query.businessId } : {}),
      ...(query.portId ? { portId: query.portId } : {}),
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
    ...(query.portId ? { portId: query.portId } : {}),
  };
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateMuelleBody,
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
      "businessId es requerido para crear un muelle",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertMuelleTenantAccess(
  actor: Actor,
  muelleBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== muelleBusinessId) {
    throw new AppError(404, "muelle_not_found", "Muelle no encontrado");
  }
}

/**
 * Valida que el puerto exista, esté activo y pertenezca a la empresa del muelle.
 */
async function assertPortForBusiness(
  portId: string,
  businessId: string,
): Promise<void> {
  const port = await prisma.port.findFirst({
    where: { id: portId, deletedAt: null },
  });
  if (!port || port.businessId !== businessId) {
    throw new AppError(400, "port_not_found", "Puerto no encontrado");
  }
}

/** Lista muelles visibles para el actor (paginado). */
export async function listMuelles(
  actor: Actor,
  query: ListMuellesQuery,
): Promise<{
  items: MuelleResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.muelle.count({ where }),
    prisma.muelle.findMany({
      where,
      include: portInclude,
      orderBy: [{ port: { name: "asc" } }, { name: "asc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toMuelleResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getMuelleById(
  actor: Actor,
  id: string,
): Promise<MuelleResponse> {
  const row = await prisma.muelle.findFirst({
    where: { id, deletedAt: null },
    include: portInclude,
  });
  if (!row) {
    throw new AppError(404, "muelle_not_found", "Muelle no encontrado");
  }
  assertMuelleTenantAccess(actor, row.businessId);
  return toMuelleResponse(row);
}

/**
 * Crea muelle (admin o superadmin).
 * Único por empresa + puerto + nombre entre no borrados.
 */
export async function createMuelle(
  actor: Actor,
  body: CreateMuelleBody,
): Promise<MuelleResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  await assertPortForBusiness(body.portId, businessId);

  try {
    const row = await prisma.muelle.create({
      data: {
        name: body.name,
        portId: body.portId,
        businessId,
        state: body.state ?? true,
      },
      include: portInclude,
    });
    return toMuelleResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_muelle",
        "Ya existe un muelle con ese nombre en este puerto y empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza muelle. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateMuelle(
  actor: Actor,
  id: string,
  payload: UpdateMuelleBody,
): Promise<MuelleResponse> {
  const existing = await prisma.muelle.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "muelle_not_found", "Muelle no encontrado");
  }
  assertMuelleTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el muelle a otra empresa",
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

  const nextPortId = payload.portId ?? existing.portId;
  await assertPortForBusiness(nextPortId, nextBusinessId);

  const data: Prisma.MuelleUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextPortId !== existing.portId) {
    data.port = { connect: { id: nextPortId } };
  }
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.muelle.update({
      where: { id },
      data,
      include: portInclude,
    });
    return toMuelleResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_muelle",
        "Ya existe un muelle con ese nombre en este puerto y empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMemberMuelle (S7), rechazar si hay asignaciones activas.
 */
export async function deleteMuelleById(
  actor: Actor,
  id: string,
): Promise<MuelleResponse> {
  const muelle = await prisma.muelle.findFirst({
    where: { id, deletedAt: null },
    include: portInclude,
  });
  if (!muelle) {
    throw new AppError(404, "muelle_not_found", "Muelle no encontrado");
  }
  assertMuelleTenantAccess(actor, muelle.businessId);

  const updated = await prisma.muelle.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
    include: portInclude,
  });
  return toMuelleResponse(updated);
}
