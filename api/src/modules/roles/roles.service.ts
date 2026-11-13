import { Prisma, type RoleDataScope } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import {
  getEnabledModuleKeySet,
  isBusinessModuleEnabled,
  listBusinessModuleStates,
} from "../../lib/businessModules.js";
import {
  PERMISSION_ACTION,
  PERMISSION_CATALOG,
  PERMISSION_RESOURCE,
  PERMISSION_RESOURCES,
  RESOURCE_TO_MODULE_KEY,
  ROLE_DATA_SCOPES,
  SYSTEM_ROLE_KEY,
  SYSTEM_ROLE_KEYS,
  catalogActionsFor,
} from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import {
  resolveNextBusinessId,
  resolveRequiredBusinessId,
  type TenantActor,
} from "../../lib/tenant.js";
import type {
  CreateRoleBody,
  ListRolesQuery,
  PermissionCatalogQuery,
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
  businessId: string | null;
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
    businessId: row.businessId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Actor mínimo para listar / mutar roles con tenant. */
type RoleActor = TenantActor;

/**
 * ¿El actor puede ver o mutar este rol?
 * Sistema: cualquiera con permiso de ruta. Custom: solo su empresa (o superadmin).
 * Custom legado sin businessId: solo superadmin.
 */
function assertCanAccessRole(
  actor: RoleActor,
  role: { isSystem: boolean; businessId: string | null },
): void {
  if (actor.internalRol === "superadmin") return;
  if (role.isSystem) return;

  if (!role.businessId) {
    throw new AppError(
      404,
      "role_not_found",
      "Rol no encontrado",
    );
  }

  if (!actor.businessId || role.businessId !== actor.businessId) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }
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
    const allowed = catalogActionsFor(row.resource);
    for (const action of row.actions) {
      if (!allowed.includes(action)) {
        throw new AppError(
          400,
          "validation_error",
          `Acción inválida para ${row.resource}: ${action}`,
        );
      }
    }
  }
}

/**
 * ¿El resource debe verse en la matriz para estos módulos activos?
 * Sin moduleKey (base / cursos) → siempre visible.
 */
function isResourceVisibleForModules(
  resource: string,
  enabledKeys: Set<string> | null,
): boolean {
  if (!enabledKeys) return true;
  const moduleKey = RESOURCE_TO_MODULE_KEY[resource];
  if (moduleKey == null) return true;
  return enabledKeys.has(moduleKey);
}

/**
 * Catálogo para la matriz de checks (R-04 / S3b).
 * Con businessId: oculta filas de Prevención cuyo submódulo está apagado.
 * Sin businessId: catálogo completo (superadmin sin empresa de contexto).
 */
export async function getPermissionCatalog(query: PermissionCatalogQuery = {}) {
  const businessId = query.businessId ?? null;

  if (businessId) {
    const business = await prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true },
    });
    if (!business) {
      throw new AppError(404, "business_not_found", "Empresa no encontrada");
    }
  }

  const enabledKeys = businessId
    ? await getEnabledModuleKeySet(businessId)
    : null;
  const modules = businessId
    ? await listBusinessModuleStates(businessId)
    : null;

  const catalog = PERMISSION_CATALOG.map((mod) => ({
    module: mod.module,
    items: mod.items
      .filter((item) =>
        isResourceVisibleForModules(item.resource, enabledKeys),
      )
      .map((item) => ({
        resource: item.resource,
        label: item.label,
        actions: [...item.actions],
        ...(item.hint ? { hint: item.hint } : {}),
      })),
  })).filter((mod) => mod.items.length > 0);

  /** Acciones solo de filas visibles (receive no aparece si no hay work_permits). */
  const actions = [
    ...new Set(
      catalog.flatMap((mod) => mod.items.flatMap((item) => item.actions)),
    ),
  ];

  return {
    actions,
    scopes: [...ROLE_DATA_SCOPES],
    /** Empresa usada para filtrar; null = sin filtro de módulos. */
    businessId,
    /** Estados de submódulos; null si no se filtró por empresa. */
    modules,
    catalog,
  };
}

/**
 * Al guardar permisos con contexto de empresa: conserva en BD los de módulos
 * apagados (no vienen en el form) y rechaza si el body intenta setearlos.
 */
export async function mergePermissionsForBusinessModules(
  businessId: string | null | undefined,
  incoming: PermissionEntry[],
  existing: PermissionEntry[] | null,
): Promise<PermissionEntry[]> {
  if (!businessId) return incoming;

  const enabledKeys = await getEnabledModuleKeySet(businessId);

  for (const row of incoming) {
    if (!isResourceVisibleForModules(row.resource, enabledKeys)) {
      throw new AppError(
        400,
        "module_disabled",
        `El recurso ${row.resource} no está disponible: su módulo está apagado en la empresa`,
      );
    }
  }

  const preserved = (existing ?? []).filter(
    (row) => !isResourceVisibleForModules(row.resource, enabledKeys),
  );

  return [...incoming, ...preserved];
}

/**
 * Lista roles visibles para el actor.
 * Superadmin: todos. Resto: sistema + custom de su empresa.
 */
export async function listRoles(
  actor: RoleActor,
  query: ListRolesQuery,
): Promise<{
  items: RoleResponse[];
  total: number;
}> {
  const where: Prisma.RoleWhereInput = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { state: true }),
  };

  if (actor.internalRol !== "superadmin") {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    where.OR = [
      { isSystem: true },
      { businessId: actor.businessId },
    ];
  }

  const rows = await prisma.role.findMany({
    where,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return {
    items: rows.map(toRoleResponse),
    total: rows.length,
  };
}

/** Detalle por id (404 si es custom de otra empresa). */
export async function getRoleById(
  actor: RoleActor,
  id: string,
): Promise<RoleResponse> {
  const row = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }
  assertCanAccessRole(actor, row);
  return toRoleResponse(row);
}

/** Crea rol custom anclado a una empresa (nunca de sistema). */
export async function createRole(
  actor: RoleActor,
  body: CreateRoleBody,
): Promise<RoleResponse> {
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

  // dataScope=all es poder global: solo superadmin lo asigna.
  if (body.dataScope === "all" && actor.internalRol !== "superadmin") {
    throw new AppError(
      403,
      "forbidden",
      "Solo superadmin puede crear un rol con alcance global",
    );
  }

  // Custom siempre tiene dueño: solo superadmin elige empresa del body.
  const businessId = resolveRequiredBusinessId(actor, body.businessId, "el rol");

  assertValidPermissions(body.permissions ?? []);

  const permissions = await mergePermissionsForBusinessModules(
    businessId,
    body.permissions ?? [],
    null,
  );

  const name = body.name.trim();
  const exists = await prisma.role.findFirst({
    where: {
      deletedAt: null,
      businessId,
      OR: [{ key }, { name }],
    },
  });
  if (exists) {
    throw new AppError(
      409,
      "duplicate_role",
      "Ya existe un rol con esa clave o nombre en esta empresa",
    );
  }

  try {
    const row = await prisma.role.create({
      data: {
        key,
        name,
        description: body.description?.trim() ?? "",
        isSystem: false,
        dataScope: body.dataScope as RoleDataScope,
        permissions,
        businessId,
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
        "Ya existe un rol con esa clave o nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza rol.
 * Sistema: permisos/nombre/desc/state; no dataScope ni key ni businessId.
 * Custom: solo la empresa dueña (o superadmin); puede moverse de tenant.
 */
export async function updateRole(
  actor: RoleActor,
  id: string,
  payload: UpdateRoleBody,
): Promise<RoleResponse> {
  const existing = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }
  assertCanAccessRole(actor, existing);

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

  if (
    payload.dataScope === "all" &&
    actor.internalRol !== "superadmin"
  ) {
    throw new AppError(
      403,
      "forbidden",
      "Solo superadmin puede asignar alcance global a un rol",
    );
  }

  // Empresa de contexto para módulos; en custom también puede reasignar dueño.
  let nextBusinessId = existing.businessId;
  if (!existing.isSystem) {
    if (!existing.businessId) {
      // Legado sin dueño: solo superadmin puede asignarle empresa.
      if (actor.internalRol !== "superadmin" || !payload.businessId) {
        throw new AppError(
          400,
          "validation_error",
          "Este rol no tiene empresa; asigná businessId como superadmin",
        );
      }
      nextBusinessId = payload.businessId;
    } else {
      nextBusinessId = resolveNextBusinessId(
        actor,
        payload.businessId,
        existing.businessId,
      );
    }
  }

  const moduleContextBusinessId =
    nextBusinessId ?? payload.businessId ?? actor.businessId ?? null;

  const data: Prisma.RoleUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name.trim();
  if (payload.description !== undefined) {
    data.description = payload.description.trim();
  }
  if (payload.state !== undefined) data.state = payload.state;
  if (payload.permissions !== undefined) {
    const existingPerms = Array.isArray(existing.permissions)
      ? (existing.permissions as PermissionEntry[])
      : [];
    data.permissions = await mergePermissionsForBusinessModules(
      moduleContextBusinessId,
      payload.permissions,
      existingPerms,
    );
  }
  if (!existing.isSystem && payload.dataScope !== undefined) {
    data.dataScope = payload.dataScope as RoleDataScope;
  }
  if (!existing.isSystem && nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId! } };
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
        "Ya existe un rol con esa clave o nombre en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete. No borra sistema ni roles con usuarios asignados.
 * Custom de otra empresa → 404.
 */
export async function deleteRoleById(
  actor: RoleActor,
  id: string,
): Promise<RoleResponse> {
  const role = await prisma.role.findFirst({
    where: { id, deletedAt: null },
  });
  if (!role) {
    throw new AppError(404, "role_not_found", "Rol no encontrado");
  }
  assertCanAccessRole(actor, role);

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
 * ¿El rol del actor tiene resource+action y el módulo de empresa está on?
 * Superadmin (internalRol) bypass; si no hay roleId, false.
 */
export async function actorHasPermission(
  actor: {
    internalRol: string;
    roleId?: string | null;
    businessId?: string | null;
  },
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
  if (!entry?.actions?.includes(action)) return false;

  /** Capa 1: resource de Prevención exige business_modules.enabled. */
  const moduleKey = RESOURCE_TO_MODULE_KEY[resource];
  if (moduleKey != null) {
    const on = await isBusinessModuleEnabled(actor.businessId, moduleKey);
    if (!on) return false;
  }

  return true;
}

/** Destinatario de digests diarios de vencimiento (cursos / libreta). */
export type ExpiryDigestRecipient = {
  id: string;
  email: string;
  businessId: string | null;
  /** Superadmin o dataScope=all: ve filas de todas las empresas. */
  seesAllBusinesses: boolean;
};

/**
 * Usuarios activos cuyo rol tiene `cursos.notifications.digest` + read.
 * No usa el bypass de internalRol=superadmin: el permiso debe estar en el rol
 * (el rol sistema superadmin lo incluye vía seed).
 */
export async function listExpiryDigestRecipients(): Promise<
  ExpiryDigestRecipient[]
> {
  const resource = PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS_DIGEST;
  const action = PERMISSION_ACTION.READ;

  const users = await prisma.user.findMany({
    where: { deletedAt: null, state: true },
    select: {
      id: true,
      email: true,
      businessId: true,
      internalRol: true,
      role: {
        select: {
          permissions: true,
          dataScope: true,
          state: true,
          deletedAt: true,
        },
      },
    },
  });

  const out: ExpiryDigestRecipient[] = [];
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email) continue;
    if (!user.role || user.role.deletedAt || !user.role.state) continue;

    const permissions = Array.isArray(user.role.permissions)
      ? (user.role.permissions as PermissionEntry[])
      : [];
    const entry = permissions.find((row) => row.resource === resource);
    if (!entry?.actions?.includes(action)) continue;

    out.push({
      id: user.id,
      email,
      businessId: user.businessId,
      seesAllBusinesses:
        user.internalRol === "superadmin" || user.role.dataScope === "all",
    });
  }
  return out;
}

/**
 * Claves de rol de staff Prevención / admin del tenant
 * (avisos de trabajo + digest de capacitaciones).
 */
const PREVENTION_STAFF_ROLE_KEYS = new Set<string>([
  SYSTEM_ROLE_KEY.ADMIN,
  SYSTEM_ROLE_KEY.PREVENCIONISTA,
]);

/**
 * Usuarios activos admin o prevencionista.
 * Opcional: filtrar por empresa (misma businessId).
 * seesAllBusinesses = superadmin o dataScope all (digests globales).
 */
export async function listPreventionStaffRecipients(options?: {
  businessId?: string;
}): Promise<ExpiryDigestRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      state: true,
      ...(options?.businessId
        ? {
            OR: [
              { businessId: options.businessId },
              { internalRol: "superadmin" },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      businessId: true,
      internalRol: true,
      role: {
        select: {
          key: true,
          dataScope: true,
          state: true,
          deletedAt: true,
        },
      },
    },
  });

  const out: ExpiryDigestRecipient[] = [];
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email) continue;

    const roleKey = user.role?.deletedAt || !user.role?.state
      ? null
      : user.role.key;
    const isStaffByRole =
      roleKey != null && PREVENTION_STAFF_ROLE_KEYS.has(roleKey);
    const isStaffByInternal =
      user.internalRol === SYSTEM_ROLE_KEY.ADMIN ||
      user.internalRol === SYSTEM_ROLE_KEY.PREVENCIONISTA;
    // Superadmin solo entra si pide digests globales (sin filtro business).
    const isSuperadmin = user.internalRol === "superadmin";
    if (!isStaffByRole && !isStaffByInternal && !isSuperadmin) continue;

    // Con filtro de empresa: excluir superadmin sin business (no es staff del tenant).
    if (
      options?.businessId &&
      user.businessId !== options.businessId &&
      !isStaffByRole &&
      !isStaffByInternal
    ) {
      continue;
    }
    if (
      options?.businessId &&
      user.businessId !== options.businessId &&
      isSuperadmin
    ) {
      continue;
    }

    out.push({
      id: user.id,
      email,
      businessId: user.businessId,
      seesAllBusinesses:
        isSuperadmin || user.role?.dataScope === "all",
    });
  }
  return out;
}
