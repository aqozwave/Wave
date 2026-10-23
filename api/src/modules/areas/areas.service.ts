import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  AreaResponse,
  CreateAreaBody,
  ListAreasQuery,
  UpdateAreaBody,
} from "./areas.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toAreaResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  locationId: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AreaResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    locationId: row.locationId,
    businessId: row.businessId,
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
  query: ListAreasQuery,
): Prisma.AreaWhereInput {
  const base: Prisma.AreaWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return {
      ...base,
      ...(query.businessId ? { businessId: query.businessId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
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
    ...(query.locationId ? { locationId: query.locationId } : {}),
  };
}

/** 404 genérico si el actor no puede ver esa empresa. */
function assertAreaTenantAccess(actor: Actor, areaBusinessId: string): void {
  if (actor.internalRol === "superadmin") {
    return;
  }
  if (!actor.businessId || actor.businessId !== areaBusinessId) {
    throw new AppError(404, "area_not_found", "Área no encontrada");
  }
}

/**
 * Carga location activa y valida tenant + coherencia businessId.
 * Devuelve businessId efectivo (= location.businessId).
 */
async function resolveLocationBusiness(
  actor: Actor,
  locationId: string,
  requestedBusinessId: string | undefined,
): Promise<{ locationId: string; businessId: string }> {
  const location = await prisma.location.findFirst({
    where: { id: locationId, deletedAt: null },
  });
  if (!location) {
    throw new AppError(400, "location_not_found", "Lugar de trabajo no encontrado");
  }

  // Admin solo puede usar locations de su empresa.
  if (actor.internalRol !== "superadmin") {
    if (!actor.businessId || actor.businessId !== location.businessId) {
      throw new AppError(
        400,
        "location_not_found",
        "Lugar de trabajo no encontrado",
      );
    }
  }

  if (
    requestedBusinessId !== undefined &&
    requestedBusinessId !== location.businessId
  ) {
    throw new AppError(
      400,
      "business_location_mismatch",
      "La empresa no coincide con el lugar de trabajo seleccionado",
    );
  }

  return { locationId: location.id, businessId: location.businessId };
}

/** Lista áreas visibles para el actor (paginado). */
export async function listAreas(
  actor: Actor,
  query: ListAreasQuery,
): Promise<{
  items: AreaResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.area.count({ where }),
    prisma.area.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toAreaResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getAreaById(
  actor: Actor,
  id: string,
): Promise<AreaResponse> {
  const row = await prisma.area.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "area_not_found", "Área no encontrada");
  }
  assertAreaTenantAccess(actor, row.businessId);
  return toAreaResponse(row);
}

/**
 * Crea área (admin o superadmin).
 * businessId siempre se toma de la location; body.businessId solo se valida.
 */
export async function createArea(
  actor: Actor,
  body: CreateAreaBody,
): Promise<AreaResponse> {
  const { locationId, businessId } = await resolveLocationBusiness(
    actor,
    body.locationId,
    body.businessId,
  );

  try {
    const row = await prisma.area.create({
      data: {
        name: body.name,
        locationId,
        businessId,
        state: body.state ?? true,
      },
    });
    return toAreaResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_area_name",
        "El nombre del área ya existe en este lugar de trabajo",
      );
    }
    throw err;
  }
}

/**
 * Actualiza área. Si cambia locationId, recalcula businessId y valida.
 */
export async function updateArea(
  actor: Actor,
  id: string,
  payload: UpdateAreaBody,
): Promise<AreaResponse> {
  const existing = await prisma.area.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "area_not_found", "Área no encontrada");
  }
  assertAreaTenantAccess(actor, existing.businessId);

  let nextLocationId = existing.locationId;
  let nextBusinessId = existing.businessId;

  if (payload.locationId !== undefined || payload.businessId !== undefined) {
    const locationId = payload.locationId ?? existing.locationId;
    const resolved = await resolveLocationBusiness(
      actor,
      locationId,
      payload.businessId,
    );
    nextLocationId = resolved.locationId;
    nextBusinessId = resolved.businessId;
  }

  const data: Prisma.AreaUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (
    nextLocationId !== existing.locationId ||
    nextBusinessId !== existing.businessId
  ) {
    data.location = { connect: { id: nextLocationId } };
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.area.update({
      where: { id },
      data,
    });
    return toAreaResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_area_name",
        "El nombre del área ya existe en este lugar de trabajo",
      );
    }
    throw err;
  }
}

/**
 * Soft delete. 409 si hay usuarios activos con ese areaId.
 */
export async function deleteAreaById(
  actor: Actor,
  id: string,
): Promise<AreaResponse> {
  const area = await prisma.area.findFirst({
    where: { id, deletedAt: null },
  });
  if (!area) {
    throw new AppError(404, "area_not_found", "Área no encontrada");
  }
  assertAreaTenantAccess(actor, area.businessId);

  const activeUsers = await prisma.user.count({
    where: {
      areaId: id,
      deletedAt: null,
      state: true,
    },
  });
  if (activeUsers > 0) {
    throw new AppError(
      409,
      "area_has_dependents",
      `No se puede eliminar el área: tiene ${activeUsers} usuario(s) activo(s)`,
    );
  }

  const updated = await prisma.area.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toAreaResponse(updated);
}
