import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreatePortBody,
  ListPortsQuery,
  PortResponse,
  UpdatePortBody,
} from "./ports.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toPortResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PortResponse {
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
 * Filtro de listado: superadmin ve todos (filtro businessId opcional);
 * admin/user solo los de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListPortsQuery,
): Prisma.PortWhereInput {
  const base: Prisma.PortWhereInput = { deletedAt: null };

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

  return { ...base, businessId: actor.businessId };
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(actor: Actor, body: CreatePortBody): string {
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
      "businessId es requerido para crear un puerto",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertPortTenantAccess(actor: Actor, portBusinessId: string): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== portBusinessId) {
    throw new AppError(404, "port_not_found", "Puerto no encontrado");
  }
}

/** Lista puertos visibles para el actor (paginado). */
export async function listPorts(
  actor: Actor,
  query: ListPortsQuery,
): Promise<{
  items: PortResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.port.count({ where }),
    prisma.port.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toPortResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getPortById(
  actor: Actor,
  id: string,
): Promise<PortResponse> {
  const row = await prisma.port.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "port_not_found", "Puerto no encontrado");
  }
  assertPortTenantAccess(actor, row.businessId);
  return toPortResponse(row);
}

/**
 * Crea puerto (admin o superadmin).
 * Nombre único por empresa entre no borrados.
 */
export async function createPort(
  actor: Actor,
  body: CreatePortBody,
): Promise<PortResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.port.create({
      data: {
        name: body.name,
        businessId,
        state: body.state ?? true,
      },
    });
    return toPortResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_port",
        "Ya existe un puerto con ese nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza puerto. Admin no puede cambiar businessId a otra empresa.
 */
export async function updatePort(
  actor: Actor,
  id: string,
  payload: UpdatePortBody,
): Promise<PortResponse> {
  const existing = await prisma.port.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "port_not_found", "Puerto no encontrado");
  }
  assertPortTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el puerto a otra empresa",
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

  const data: Prisma.PortUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.port.update({
      where: { id },
      data,
    });
    return toPortResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_port",
        "Ya existe un puerto con ese nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Rechaza si hay muelles activos vinculados al puerto.
 */
export async function deletePortById(
  actor: Actor,
  id: string,
): Promise<PortResponse> {
  const port = await prisma.port.findFirst({
    where: { id, deletedAt: null },
  });
  if (!port) {
    throw new AppError(404, "port_not_found", "Puerto no encontrado");
  }
  assertPortTenantAccess(actor, port.businessId);

  const activeMuelles = await prisma.muelle.count({
    where: { portId: id, deletedAt: null },
  });
  if (activeMuelles > 0) {
    throw new AppError(
      409,
      "port_in_use",
      "No se puede eliminar: hay muelles activos en este puerto",
    );
  }

  const updated = await prisma.port.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toPortResponse(updated);
}
