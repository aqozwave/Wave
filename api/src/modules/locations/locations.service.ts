import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateLocationBody,
  ListLocationsQuery,
  LocationResponse,
  UpdateLocationBody,
} from "./locations.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toLocationResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  kind: "vessel" | "office" | "warehouse" | "other" | null;
  businessId: string;
  country: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): LocationResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    kind: row.kind,
    businessId: row.businessId,
    country: row.country,
    commune: row.commune,
    city: row.city,
    phone: row.phone,
    email: row.email,
    description: row.description,
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
  query: ListLocationsQuery,
): Prisma.LocationWhereInput {
  const base: Prisma.LocationWhereInput = { deletedAt: null };

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
  body: CreateLocationBody,
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

  // superadmin (y cualquier manager no-admin: solo superadmin llega por middleware)
  if (!body.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido para crear una ubicación",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertLocationTenantAccess(
  actor: Actor,
  locationBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== locationBusinessId) {
    throw new AppError(404, "location_not_found", "Ubicación no encontrada");
  }
}

/**
 * Lista ubicaciones visibles para el actor (paginado).
 */
export async function listLocations(
  actor: Actor,
  query: ListLocationsQuery,
): Promise<{
  items: LocationResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.location.count({ where }),
    prisma.location.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toLocationResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * Crea ubicación (admin o superadmin).
 * Nombre único por empresa entre no borradas.
 */
export async function createLocation(
  actor: Actor,
  body: CreateLocationBody,
): Promise<LocationResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.location.create({
      data: {
        name: body.name,
        kind: body.kind ?? null,
        businessId,
        country: body.country ?? "Chile",
        commune: body.commune ?? null,
        city: body.city ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        description: body.description ?? null,
        state: body.state ?? true,
      },
    });
    return toLocationResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_location_name",
        "El nombre del lugar de trabajo ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Detalle por id (tenant-aware).
 */
export async function getLocationById(
  actor: Actor,
  id: string,
): Promise<LocationResponse> {
  const row = await prisma.location.findFirst({
    where: { id, deletedAt: null },
  });

  if (!row) {
    throw new AppError(404, "location_not_found", "Ubicación no encontrada");
  }

  assertLocationTenantAccess(actor, row.businessId);
  return toLocationResponse(row);
}

/**
 * Actualiza ubicación (admin o superadmin).
 * Admin: no puede cambiar businessId a otra empresa.
 */
export async function updateLocation(
  actor: Actor,
  id: string,
  payload: UpdateLocationBody,
): Promise<LocationResponse> {
  const existing = await prisma.location.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "location_not_found", "Ubicación no encontrada");
  }

  assertLocationTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      // Admin queda anclado a su empresa.
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes mover la ubicación a otra empresa",
        );
      }
      nextBusinessId = actor.businessId!;
    } else {
      nextBusinessId = payload.businessId;
      const business = await prisma.business.findFirst({
        where: { id: nextBusinessId, deletedAt: null },
      });
      if (!business) {
        throw new AppError(400, "business_not_found", "Empresa no encontrada");
      }
    }
  }

  const data: Prisma.LocationUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.businessId !== undefined) {
    data.business = { connect: { id: nextBusinessId } };
  }
  if (payload.country !== undefined) data.country = payload.country ?? null;
  if (payload.commune !== undefined) data.commune = payload.commune ?? null;
  if (payload.city !== undefined) data.city = payload.city ?? null;
  if (payload.phone !== undefined) data.phone = payload.phone ?? null;
  if (payload.email !== undefined) data.email = payload.email ?? null;
  if (payload.description !== undefined) {
    data.description = payload.description ?? null;
  }
  if (payload.state !== undefined) data.state = payload.state;

  try {
    const updated = await prisma.location.update({
      where: { id },
      data,
    });
    return toLocationResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_location_name",
        "El nombre del lugar de trabajo ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete: deletedAt + state=false.
 * 409 si hay usuarios activos con esa locationId.
 */
export async function deleteLocationById(
  actor: Actor,
  id: string,
): Promise<LocationResponse> {
  const location = await prisma.location.findFirst({
    where: { id, deletedAt: null },
  });

  if (!location) {
    throw new AppError(404, "location_not_found", "Ubicación no encontrada");
  }

  assertLocationTenantAccess(actor, location.businessId);

  const activeUsers = await prisma.user.count({
    where: {
      locationId: id,
      deletedAt: null,
      state: true,
    },
  });

  if (activeUsers > 0) {
    throw new AppError(
      409,
      "location_has_dependents",
      `No se puede eliminar el lugar de trabajo: tiene ${activeUsers} usuario(s) activo(s)`,
    );
  }

  const updated = await prisma.location.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });

  return toLocationResponse(updated);
}
