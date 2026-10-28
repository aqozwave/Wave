import { Prisma, type User } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import {
  ALLOWED_USER_PHOTO_MIMES,
  MAX_USER_PHOTO_BYTES,
  isUserPhotoRelativePath,
  unlinkUserPhotoFile,
  writeUserPhotoFile,
} from "../../lib/localUploads.js";
import { hashPassword } from "../../lib/password.js";
import { SYSTEM_ROLE_KEYS } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { requestPasswordReset } from "../auth/auth.service.js";
import type {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
  UploadUserPhotoBody,
  UserAdminResponse,
} from "./users.schemas.js";

/** Actor mínimo para reglas de tenant y permisos de gestión. */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

/** Include de relaciones usadas en el contrato admin. */
const userAdminInclude = {
  role: { select: { id: true, key: true, name: true } },
  business: { select: { id: true, name: true } },
} as const;

type UserAdminRow = User & {
  role: { id: string; key: string; name: string } | null;
  business: { id: string; name: string } | null;
};

/** Serializa fila Prisma → contrato Zod (sin secretos). */
function toUserAdminResponse(row: UserAdminRow): UserAdminResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    run: row.run,
    username: row.username,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    pendingEmail: row.pendingEmail,
    photoProfile: row.photoProfile,
    internalRol: row.internalRol,
    roleId: row.roleId,
    role: row.role
      ? { id: row.role.id, key: row.role.key, name: row.role.name }
      : null,
    businessId: row.businessId,
    business: row.business
      ? { id: row.business.id, name: row.business.name }
      : null,
    locationId: row.locationId,
    areaId: row.areaId,
    state: row.state,
    confirmed: row.confirmed,
    loginAttempts: row.loginAttempts,
    lockUntil: row.lockUntil ? row.lockUntil.toISOString() : null,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Superadmin ve todos; admin solo su empresa. */
function listWhere(
  actor: Actor,
  query: ListUsersQuery,
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { state: true }),
  };

  const search = query.search?.trim();
  if (search) {
    base.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { run: { contains: search, mode: "insensitive" } },
    ];
  }

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
 * 404 genérico si el actor no puede ver ese usuario
 * (no filtrar existencia a otra empresa).
 */
function assertUserTenantAccess(actor: Actor, target: User): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || target.businessId !== actor.businessId) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
}

/** Admin no gestiona cuentas superadmin. */
function assertCanManageTarget(actor: Actor, target: User): void {
  if (
    actor.internalRol !== "superadmin" &&
    target.internalRol === "superadmin"
  ) {
    throw new AppError(
      403,
      "forbidden",
      "No puedes gestionar una cuenta superadmin",
    );
  }
}

/**
 * Si roleId apunta a un rol de sistema, alinea internalRol a role.key.
 * Roles custom dejan internalRol en "user" (legado).
 */
async function resolveInternalRolFromRole(
  roleId: string | null | undefined,
  currentInternalRol: string,
): Promise<string> {
  if (roleId === undefined) {
    return currentInternalRol;
  }
  if (roleId === null) {
    return currentInternalRol === "superadmin" ? "superadmin" : "user";
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, deletedAt: null, state: true },
  });
  if (!role) {
    throw new AppError(400, "validation_error", "Rol no encontrado o inactivo");
  }

  if ((SYSTEM_ROLE_KEYS as readonly string[]).includes(role.key)) {
    return role.key;
  }
  return "user";
}

/** Valida FKs de tenant (empresa / location / area) existen y coherentes. */
async function assertTenantFks(input: {
  businessId: string | null;
  locationId: string | null;
  areaId: string | null;
}): Promise<void> {
  if (input.businessId) {
    const business = await prisma.business.findFirst({
      where: { id: input.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "validation_error", "Empresa no encontrada");
    }
  }

  if (input.locationId) {
    const location = await prisma.location.findFirst({
      where: { id: input.locationId, deletedAt: null },
    });
    if (!location) {
      throw new AppError(
        400,
        "validation_error",
        "Lugar de trabajo no encontrado",
      );
    }
    if (input.businessId && location.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "El lugar de trabajo no pertenece a la empresa",
      );
    }
  }

  if (input.areaId) {
    const area = await prisma.area.findFirst({
      where: { id: input.areaId, deletedAt: null },
    });
    if (!area) {
      throw new AppError(400, "validation_error", "Área no encontrada");
    }
    if (input.businessId && area.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "El área no pertenece a la empresa",
      );
    }
    if (input.locationId && area.locationId !== input.locationId) {
      throw new AppError(
        400,
        "validation_error",
        "El área no pertenece al lugar de trabajo",
      );
    }
  }
}

/** Unicidad email / username / run entre no borrados. */
async function assertIdentityAvailable(input: {
  email: string;
  username: string;
  run: string;
  excludeUserId?: string;
}): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: input.email },
        { username: input.username },
        { run: input.run },
      ],
      ...(input.excludeUserId
        ? { NOT: { id: input.excludeUserId } }
        : {}),
    },
  });

  if (!existing) return;

  if (existing.email === input.email) {
    throw new AppError(
      409,
      "duplicate_email",
      "El correo electrónico ya está registrado",
    );
  }
  if (existing.username === input.username) {
    throw new AppError(
      409,
      "duplicate_username",
      "El nombre de usuario ya está en uso",
    );
  }
  throw new AppError(409, "duplicate_run", "El RUN ya está registrado");
}

/** Resuelve businessId de creación: admin → su empresa; superadmin → body. */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateUserBody,
): string | null {
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

  return body.businessId === undefined ? null : body.businessId;
}

/** Lista usuarios paginados con búsqueda. */
export async function listUsers(
  actor: Actor,
  query: ListUsersQuery,
): Promise<{
  items: UserAdminResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userAdminInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toUserAdminResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (scoped). */
export async function getUserById(
  actor: Actor,
  id: string,
): Promise<UserAdminResponse> {
  const row = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: userAdminInclude,
  });
  if (!row) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, row);
  return toUserAdminResponse(row);
}

/**
 * Alta admin: confirmed=false hasta que abra el enlace.
 * Un solo correo de clave: al usarlo queda confirmado y con contraseña propia.
 */
export async function createUser(
  actor: Actor,
  body: CreateUserBody,
): Promise<UserAdminResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const locationId = body.locationId ?? null;
  const areaId = body.areaId ?? null;
  const roleId = body.roleId ?? null;

  // Solo superadmin puede crear otro superadmin (vía role key).
  const internalRol = await resolveInternalRolFromRole(roleId, "user");
  if (internalRol === "superadmin" && actor.internalRol !== "superadmin") {
    throw new AppError(
      403,
      "forbidden",
      "No puedes crear una cuenta superadmin",
    );
  }

  if (internalRol !== "superadmin" && !businessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido para usuarios que no son superadmin",
    );
  }

  await assertTenantFks({ businessId, locationId, areaId });
  await assertIdentityAvailable({
    email: body.email,
    username: body.username,
    run: body.run,
  });

  const passwordHash = await hashPassword(body.password);

  const created = await prisma.user.create({
    data: {
      email: body.email,
      username: body.username,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      run: body.run,
      confirmed: false,
      state: body.state ?? true,
      internalRol,
      roleId,
      businessId,
      locationId,
      areaId,
    },
    include: userAdminInclude,
  });

  await requestPasswordReset(created.email);

  return toUserAdminResponse(created);
}

/** Actualiza campos admin; email nuevo → pendingEmail + reenvío confirmación. */
export async function updateUser(
  actor: Actor,
  id: string,
  body: UpdateUserBody,
): Promise<UserAdminResponse> {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, existing);
  assertCanManageTarget(actor, existing);

  if (actor.internalRol !== "superadmin" && body.businessId !== undefined) {
    if (body.businessId !== actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover el usuario a otra empresa",
      );
    }
  }

  const nextBusinessId =
    body.businessId !== undefined ? body.businessId : existing.businessId;
  const nextLocationId =
    body.locationId !== undefined ? body.locationId : existing.locationId;
  const nextAreaId =
    body.areaId !== undefined ? body.areaId : existing.areaId;
  const nextRoleId =
    body.roleId !== undefined ? body.roleId : existing.roleId;

  const nextInternalRol = await resolveInternalRolFromRole(
    body.roleId !== undefined ? body.roleId : undefined,
    existing.internalRol,
  );

  if (
    nextInternalRol === "superadmin" &&
    actor.internalRol !== "superadmin"
  ) {
    throw new AppError(
      403,
      "forbidden",
      "No puedes asignar el rol superadmin",
    );
  }

  if (nextInternalRol !== "superadmin" && !nextBusinessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido para usuarios que no son superadmin",
    );
  }

  await assertTenantFks({
    businessId: nextBusinessId,
    locationId: nextLocationId,
    areaId: nextAreaId,
  });

  const nextEmail = body.email ?? existing.email;
  const nextUsername = body.username ?? existing.username;
  const nextRun = body.run ?? existing.run;

  await assertIdentityAvailable({
    email: nextEmail,
    username: nextUsername,
    run: nextRun,
    excludeUserId: existing.id,
  });

  const data: Prisma.UserUpdateInput = {};

  if (body.firstName !== undefined) data.firstName = body.firstName;
  if (body.lastName !== undefined) data.lastName = body.lastName;
  if (body.username !== undefined) data.username = body.username;
  if (body.run !== undefined) data.run = body.run;
  if (body.state !== undefined) data.state = body.state;
  if (body.confirmed !== undefined) data.confirmed = body.confirmed;
  if (body.password !== undefined) {
    data.passwordHash = await hashPassword(body.password);
    data.tokenVersion = { increment: 1 };
  }

  if (body.roleId !== undefined) {
    data.role =
      body.roleId === null
        ? { disconnect: true }
        : { connect: { id: body.roleId } };
    data.internalRol = nextInternalRol;
  }

  if (body.businessId !== undefined) {
    data.business =
      body.businessId === null
        ? { disconnect: true }
        : { connect: { id: body.businessId } };
  }

  if (body.locationId !== undefined) {
    data.location =
      body.locationId === null
        ? { disconnect: true }
        : { connect: { id: body.locationId } };
  }

  if (body.areaId !== undefined) {
    data.area =
      body.areaId === null
        ? { disconnect: true }
        : { connect: { id: body.areaId } };
  }

  // Admin pisa el email directo (sin flujo pendingEmail; eso es self-service).
  if (body.email !== undefined) {
    data.email = body.email;
    data.pendingEmail = null;
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data,
    include: userAdminInclude,
  });

  return toUserAdminResponse(updated);
}

/** Soft delete; no permite borrarse a sí mismo. */
export async function deleteUserById(
  actor: Actor,
  id: string,
): Promise<UserAdminResponse> {
  if (actor.id === id) {
    throw new AppError(
      400,
      "validation_error",
      "No puedes eliminar tu propia cuenta",
    );
  }

  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, existing);
  assertCanManageTarget(actor, existing);

  const deleted = await prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
      tokenVersion: { increment: 1 },
    },
    include: userAdminInclude,
  });

  return toUserAdminResponse(deleted);
}

/** Limpia bloqueo por intentos fallidos (loginAttempts + lockUntil). */
export async function unlockUserById(
  actor: Actor,
  id: string,
): Promise<UserAdminResponse> {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, existing);
  assertCanManageTarget(actor, existing);

  const unlocked = await prisma.user.update({
    where: { id },
    data: {
      loginAttempts: 0,
      lockUntil: null,
    },
    include: userAdminInclude,
  });

  return toUserAdminResponse(unlocked);
}

/** Decodifica base64 puro o data-URL (data:image/…;base64,…). */
function decodeBase64Content(contentBase64: string): Buffer {
  const trimmed = contentBase64.trim();
  const comma = trimmed.indexOf(",");
  const raw =
    trimmed.startsWith("data:") && comma >= 0
      ? trimmed.slice(comma + 1)
      : trimmed;
  return Buffer.from(raw, "base64");
}

/**
 * Sube o reemplaza la foto de perfil.
 * JPEG/PNG/WebP, máx 2 MB. Borra el archivo anterior si existía.
 */
export async function uploadUserPhoto(
  actor: Actor,
  id: string,
  body: UploadUserPhotoBody,
): Promise<UserAdminResponse> {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, existing);
  assertCanManageTarget(actor, existing);

  if (!ALLOWED_USER_PHOTO_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (JPEG, PNG o WebP)",
    );
  }

  const buffer = decodeBase64Content(body.contentBase64);
  if (!buffer.length) {
    throw new AppError(400, "validation_error", "Archivo vacío o base64 inválido");
  }
  if (buffer.length > MAX_USER_PHOTO_BYTES) {
    throw new AppError(
      400,
      "validation_error",
      "La foto supera el máximo de 2 MB",
    );
  }

  const previous = existing.photoProfile;
  const written = await writeUserPhotoFile({
    businessId: existing.businessId,
    userId: existing.id,
    mimeType: body.mimeType,
    buffer,
  });

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { photoProfile: written.relativePath },
    include: userAdminInclude,
  });

  if (previous && previous !== written.relativePath) {
    await unlinkUserPhotoFile(previous);
  }

  return toUserAdminResponse(updated);
}

/** Quita la foto de perfil y borra el archivo del disco. */
export async function deleteUserPhoto(
  actor: Actor,
  id: string,
): Promise<UserAdminResponse> {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "user_not_found", "Usuario no encontrado");
  }
  assertUserTenantAccess(actor, existing);
  assertCanManageTarget(actor, existing);

  const previous = existing.photoProfile;
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { photoProfile: null },
    include: userAdminInclude,
  });

  if (previous && isUserPhotoRelativePath(previous)) {
    await unlinkUserPhotoFile(previous);
  }

  return toUserAdminResponse(updated);
}
