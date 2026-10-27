import { Prisma, type RoleDataScope } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import {
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  PERMISSION_RESOURCES,
  ROLE_DATA_SCOPES,
  SYSTEM_ROLE_KEYS,
} from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateRoleBody,
  ListRolesQuery,
  PermissionEntry,
  RoleResponse,
  UpdateRoleBody,
} from "./roles.schemas.js";

/** Normaliza clave de rol (minúsculas, guiones). */
function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

/** Serializa fila Prisma → contrato Zod. */
function toRoleResponse(row: {
  id: string;
  legacyMongoId: string | null;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  dataScope: RoleDataScope;
  permissions: Prisma.JsonValue;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RoleResponse {
  const permissions = Array.isArray(row.permissions)
    ? (row.permissions as PermissionEntry[])
    : [];
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    dataScope: row.dataScope,
    permissions,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Valida resource/actions contra el catálogo fijo. */
function assertValidPermissions(permissions: PermissionEntry[]): void {
  for (const row of permissions) {
    if (!(PERMISSION_RESOURCES as readonly string[]).includes(row.resource)) {
      throw new AppError(
        400,
        "validation_error",
        `Recurso de permiso inválido: ${row.resource}`,
      );
    }
    if (!row.actions.length) {
      throw new AppError(
        400,
        "validation_error",
        `El recurso ${row.resource} requiere al menos una acción`,
      );
    }
    for (const action of row.actions) {
      if (!(PERMISSION_ACTIONS as readonly string[]).includes(action)) {
        throw new AppError(
          400,
          "validation_error",
          `Acción inválida: ${action}`,
        );
      }
    }
  }
}

/** Catálogo estático para la matriz de checks en UI. */
export function getPermissionCatalog() {
  return {
    actions: [...PERMISSION_ACTIONS],
    scopes: [...ROLE_DATA_SCOPES],
    catalog: PERMISSION_CATALOG.map((mod) => ({
      module: mod.module,
      items: mod.items.map((item) => ({
        resource: item.resource,
        label: item.label,
        actions: [...item.actions],
        ...(item.hint ? { hint: item.hint } : {}),
      })),
    })),
  };
}

/** Lista roles (activos por defecto). */
export async function listRoles(query: ListRolesQuery): Promise<{
  items: RoleResponse[];
  total: number;
}> {
  const where: Prisma.RoleWhereInput = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { state: true }),
  };

  const rows = await prisma.role.findMany({
    where,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return {
    items: rows.map(toRoleResponse),
    total: rows.length,
  };
}

/** Detalle por id. */
export async function getRoleById(id: string): Promise<RoleResponse> {
  const row = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }
  return toRoleResponse(row);
}

/** Crea rol custom (no sistema). */
export async function createRole(body: CreateRoleBody): Promise<RoleResponse> {
  const key = normalizeKey(body.key || body.name);
  if (!key) {
    throw new AppError(400, "validation_error", "La clave del rol es requerida");
  }

  if ((SYSTEM_ROLE_KEYS as readonly string[]).includes(key)) {
    throw new AppError(
      400,
      "validation_error",
      "Esa clave está reservada para un rol de sistema",
    );
  }

  assertValidPermissions(body.permissions ?? []);

  const exists = await prisma.role.findFirst({
    where: {
      deletedAt: null,
      OR: [{ key }, { name: body.name.trim() }],
    },
  });
  if (exists) {
    throw new AppError(
      409,
      "duplicate_role",
      "Ya existe un rol con esa clave o nombre",
    );
  }

  try {
    const row = await prisma.role.create({
      data: {
        key,
        name: body.name.trim(),
        description: body.description?.trim() ?? "",
        isSystem: false,
        dataScope: body.dataScope as RoleDataScope,
        permissions: body.permissions ?? [],
        state: body.state ?? true,
      },
    });
    return toRoleResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_role",
        "Ya existe un rol con esa clave o nombre",
      );
    }
    throw err;
  }
}

/**
 * Actualiza rol.
 * Sistema: se pueden editar permisos/nombre/desc/state; no dataScope ni key.
 */
export async function updateRole(
  id: string,
  payload: UpdateRoleBody,
): Promise<RoleResponse> {
  const existing = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }

  if (payload.permissions !== undefined) {
    assertValidPermissions(payload.permissions);
  }

  if (existing.isSystem && payload.dataScope !== undefined) {
    throw new AppError(
      400,
      "validation_error",
      "No se puede cambiar el alcance de un rol de sistema",
    );
  }

  const data: Prisma.RoleUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name.trim();
  if (payload.description !== undefined) {
    data.description = payload.description.trim();
  }
  if (payload.state !== undefined) data.state = payload.state;
  if (payload.permissions !== undefined) {
    data.permissions = payload.permissions;
  }
  if (!existing.isSystem && payload.dataScope !== undefined) {
    data.dataScope = payload.dataScope as RoleDataScope;
  }

  try {
    const updated = await prisma.role.update({
      where: { id },
      data,
    });
    return toRoleResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_role",
        "Ya existe un rol con ese nombre",
      );
    }
    throw err;
  }
}

/**
 * Soft delete. No borra sistema ni roles con usuarios asignados.
 */
export async function deleteRoleById(id: string): Promise<RoleResponse> {
  const role = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!role) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }

  if (role.isSystem) {
    throw new AppError(
      400,
      "validation_error",
      "No se puede eliminar un rol de sistema",
    );
  }

  const inUse = await prisma.user.count({
    where: { roleId: id, deletedAt: null },
  });
  if (inUse > 0) {
    throw new AppError(
      409,
      "role_in_use",
      `No se puede eliminar: hay ${inUse} usuario(s) con este rol`,
    );
  }

  const updated = await prisma.role.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toRoleResponse(updated);
}

/**
 * ¿El rol del actor tiene resource+action?
 * Superadmin (internalRol) bypass; si no hay roleId, false.
 */
export async function actorHasPermission(
  actor: { internalRol: string; roleId?: string | null },
  resource: string,
  action: string,
): Promise<boolean> {
  if (actor.internalRol === "superadmin") return true;
  if (!actor.roleId) return false;

  const role = await prisma.role.findFirst({
    where: { id: actor.roleId, deletedAt: null, state: true },
  });
  if (!role) return false;

  const permissions = Array.isArray(role.permissions)
    ? (role.permissions as PermissionEntry[])
    : [];
  const entry = permissions.find((row) => row.resource === resource);
  return Boolean(entry?.actions?.includes(action));
}
