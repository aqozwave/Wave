/**
 * Alcance de datos del actor (Role.dataScope + User.businessId/locationId/areaId).
 * Un solo lugar para listados y asserts de tenant / nave / área / self.
 */
import type { AuthUser } from "../modules/auth/auth.schemas.js";
import { AppError } from "./errors.js";

/** Campos de sesión usados para acotar consultas (`id` solo para self). */
export type DataScopeActor = Pick<
  AuthUser,
  | "internalRol"
  | "businessId"
  | "locationId"
  | "areaId"
  | "organizationId"
  | "dataScope"
> & {
  id?: string;
};

/** Fila con posibles claves de aislamiento. */
export type DataScopeRow = {
  businessId: string;
  locationId?: string | null;
  areaId?: string | null;
  organizationId?: string | null;
  /** Dueño “self” (p. ej. crew.userId). */
  userId?: string | null;
};

/** Opciones al armar el where de listado. */
export type DataScopeWhereOptions = {
  /**
   * Campo de nave en el modelo. Default `locationId`.
   * `id` = el recurso ES la ubicación (tabla locations).
   * `null` = el recurso no es por nave (solo empresa / org).
   */
  locationField?: "locationId" | "id" | null;
  /**
   * Campo de área; default null (no filtrar).
   * `id` = el recurso ES el área (tabla areas).
   * `requestingAreaId` = avisos de trabajo.
   */
  areaField?: "areaId" | "id" | "requestingAreaId" | null;
  /** Campo de org contratista; default null. */
  organizationField?: "organizationId" | null;
  /**
   * Campo “dueño” para dataScope self. Default `userId`.
   * En users el dueño es la propia fila → `id`.
   */
  selfField?: "userId" | "id";
};

/**
 * Extiende un where Prisma con business / location / area / org
 * según el dataScope del actor. Superadmin no agrega filtro de tenant.
 */
export function applyDataScopeToWhere<T extends Record<string, unknown>>(
  actor: DataScopeActor,
  base: T,
  options: DataScopeWhereOptions = {},
): T {
  const locationField =
    options.locationField === undefined ? "locationId" : options.locationField;
  const areaField = options.areaField ?? null;
  const organizationField = options.organizationField ?? null;
  const selfField = options.selfField ?? "userId";

  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    return base;
  }

  // Portal contratista en recurso sin organizationField (maestros staff, etc.):
  // 403 en vez de armar un where inválido (p. ej. userId en Rank → 500 Prisma).
  if (actor.organizationId && !organizationField) {
    throw new AppError(
      403,
      "forbidden",
      "No tenés acceso a este recurso",
    );
  }

  // Portal contratista: solo su organización.
  if (actor.organizationId && organizationField) {
    return {
      ...base,
      [organizationField]: actor.organizationId,
    } as T;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  const scoped: Record<string, unknown> = {
    ...base,
    businessId: actor.businessId,
  };

  const scope = actor.dataScope;

  if (scope === "location") {
    if (!actor.locationId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una nave asignada",
      );
    }
    if (locationField) {
      scoped[locationField] = actor.locationId;
    }
    return scoped as T;
  }

  if (scope === "area") {
    if (!actor.areaId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene un área asignada",
      );
    }
    if (areaField) {
      scoped[areaField] = actor.areaId;
    } else if (locationField && actor.locationId) {
      /** Sin área en el modelo: al menos no salir de la nave. */
      scoped[locationField] = actor.locationId;
    }
    return scoped as T;
  }

  if (scope === "self") {
    if (organizationField && actor.organizationId) {
      scoped[organizationField] = actor.organizationId;
      return scoped as T;
    }
    if (!actor.id) {
      throw new AppError(
        403,
        "forbidden",
        "Tu sesión no permite alcance personal",
      );
    }
    /** Self interno: solo filas propias. */
    scoped[selfField] = actor.id;
    return scoped as T;
  }

  // business (default) o dataScope null → toda la empresa.
  return scoped as T;
}

/**
 * 404/403 si el actor no puede ver la fila (misma regla que el listado).
 * `notFound` evita filtrar existencia cross-tenant.
 */
export function assertDataScopeAccess(
  actor: DataScopeActor,
  row: DataScopeRow,
  notFound: { code: string; message: string },
): void {
  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    return;
  }

  if (actor.organizationId) {
    if (
      !row.organizationId ||
      actor.organizationId !== row.organizationId
    ) {
      throw new AppError(404, notFound.code, notFound.message);
    }
    return;
  }

  if (!actor.businessId || actor.businessId !== row.businessId) {
    throw new AppError(404, notFound.code, notFound.message);
  }

  const scope = actor.dataScope;

  if (scope === "location") {
    /** Location table: row.id; resto: row.locationId. */
    const rowLocationId = row.locationId ?? null;
    if (!actor.locationId || actor.locationId !== rowLocationId) {
      throw new AppError(403, "forbidden", "Este recurso no es de tu nave");
    }
    return;
  }

  if (scope === "area") {
    if (row.areaId != null) {
      if (!actor.areaId || actor.areaId !== row.areaId) {
        throw new AppError(403, "forbidden", "Este recurso no es de tu área");
      }
      return;
    }
    if (
      row.locationId != null &&
      actor.locationId &&
      actor.locationId !== row.locationId
    ) {
      throw new AppError(403, "forbidden", "Este recurso no es de tu nave");
    }
    return;
  }

  if (scope === "self") {
    if (actor.organizationId) {
      if (actor.organizationId !== row.organizationId) {
        throw new AppError(404, notFound.code, notFound.message);
      }
      return;
    }
    if (row.userId != null && (!actor.id || row.userId !== actor.id)) {
      throw new AppError(404, notFound.code, notFound.message);
    }
  }
}
