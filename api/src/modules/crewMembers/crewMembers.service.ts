import { randomBytes } from "node:crypto";
import { Prisma, type CrewMember, type RoleDataScope } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { requestPasswordReset } from "../auth/auth.service.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import {
  assignCertificateCoursesToCrewMember,
  computeCourseCompliancePercents,
  reconcileCrewMemberCertificateCourses,
} from "../crewMemberCourses/crewMemberCourses.service.js";
import type {
  ChangeCrewMemberAccessRoleBody,
  CreateCrewMemberBody,
  CrewAccessResponse,
  CrewMemberResponse,
  GrantCrewMemberAccessBody,
  ListCrewMembersQuery,
  UpdateCrewMemberBody,
} from "./crewMembers.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Claves de rol permitidas en Acceso (capitán / tripulante de nave). */
const ACCESS_ROLE_KEYS = ["user", "colaborador"] as const;
type AccessRoleKey = (typeof ACCESS_ROLE_KEYS)[number];

/**
 * Serializa fila Prisma → contrato Zod.
 * courseCompliancePercent viene de un cálculo aparte (listado/detalle).
 */
function toCrewMemberResponse(
  row: CrewMember,
  courseCompliancePercent: number | null = null,
): CrewMemberResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    run: row.run,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    birthDate: row.birthDate ? row.birthDate.toISOString() : null,
    nationality: row.nationality,
    phone: row.phone,
    direction: row.direction,
    observation: row.observation,
    boardingBookValidUntil: row.boardingBookValidUntil.toISOString(),
    businessId: row.businessId,
    locationId: row.locationId,
    areaId: row.areaId,
    rankId: row.rankId,
    academicDegreeId: row.academicDegreeId,
    competencyCertificateId: row.competencyCertificateId,
    userId: row.userId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    courseCompliancePercent,
  };
}

/** Adjunta el % de cumplimiento de cursos al serializar un tripulante. */
async function toCrewMemberResponseWithCompliance(
  row: CrewMember,
): Promise<CrewMemberResponse> {
  const compliance = await computeCourseCompliancePercents([
    {
      id: row.id,
      competencyCertificateId: row.competencyCertificateId,
    },
  ]);
  return toCrewMemberResponse(row, compliance.get(row.id) ?? null);
}

/** Filtro de listado: superadmin ve todas; admin/user solo su empresa. */
function listWhere(
  actor: Actor,
  query: ListCrewMembersQuery,
): Prisma.CrewMemberWhereInput {
  const base: Prisma.CrewMemberWhereInput = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { state: true }),
  };

  const search = query.search?.trim();
  if (search) {
    base.OR = [
      { run: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (query.locationId) {
    base.locationId = query.locationId;
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

/** 404 genérico si el actor no puede ver esa empresa. */
function assertCrewTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") {
    return;
  }
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
}

/**
 * Tenant manager (admin, prevencionista, etc.) → su empresa.
 * Superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateCrewMemberBody,
): string {
  if (actor.internalRol !== "superadmin") {
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
      "businessId es requerido para crear un tripulante",
    );
  }
  return body.businessId;
}

/**
 * Valida que location/area/rank/degree/cert existan y pertenezcan a businessId.
 * userId opcional: debe existir, no borrado, y no estar ya vinculado.
 */
async function assertCrewFks(input: {
  businessId: string;
  locationId: string;
  areaId: string | null;
  rankId: string | null;
  academicDegreeId: string | null;
  competencyCertificateId: string | null;
  userId: string | null;
  excludeCrewId?: string;
}): Promise<void> {
  const business = await prisma.business.findFirst({
    where: { id: input.businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "validation_error", "Empresa no encontrada");
  }

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
  if (location.businessId !== input.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "El lugar de trabajo no pertenece a la empresa",
    );
  }

  if (input.areaId) {
    const area = await prisma.area.findFirst({
      where: { id: input.areaId, deletedAt: null },
    });
    if (!area) {
      throw new AppError(400, "validation_error", "Área no encontrada");
    }
    if (area.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "El área no pertenece a la empresa",
      );
    }
    if (area.locationId !== input.locationId) {
      throw new AppError(
        400,
        "validation_error",
        "El área no pertenece al lugar de trabajo",
      );
    }
  }

  if (input.rankId) {
    const rank = await prisma.rank.findFirst({
      where: { id: input.rankId, deletedAt: null },
    });
    if (!rank || rank.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "Rango no encontrado en la empresa",
      );
    }
  }

  if (input.academicDegreeId) {
    const degree = await prisma.academicDegree.findFirst({
      where: { id: input.academicDegreeId, deletedAt: null },
    });
    if (!degree || degree.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "Título académico no encontrado en la empresa",
      );
    }
  }

  if (input.competencyCertificateId) {
    const cert = await prisma.competencyCertificate.findFirst({
      where: { id: input.competencyCertificateId, deletedAt: null },
    });
    if (!cert || cert.businessId !== input.businessId) {
      throw new AppError(
        400,
        "validation_error",
        "Certificado de competencia no encontrado en la empresa",
      );
    }
  }

  if (input.userId) {
    const user = await prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
    });
    if (!user) {
      throw new AppError(400, "validation_error", "Usuario no encontrado");
    }
    if (
      user.businessId &&
      user.businessId !== input.businessId &&
      user.internalRol !== "superadmin"
    ) {
      throw new AppError(
        400,
        "validation_error",
        "El usuario no pertenece a la empresa del tripulante",
      );
    }

    const linked = await prisma.crewMember.findFirst({
      where: {
        userId: input.userId,
        deletedAt: null,
        ...(input.excludeCrewId
          ? { NOT: { id: input.excludeCrewId } }
          : {}),
      },
    });
    if (linked) {
      throw new AppError(
        409,
        "user_already_linked",
        "Ese usuario ya está vinculado a otro tripulante",
      );
    }
  }
}

/** Mapea error P2002 de índices únicos a AppError legible. */
function mapUniqueViolation(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
    if (fields.includes("run") || fields.includes("business_run")) {
      throw new AppError(
        409,
        "duplicate_run",
        "El RUN ya existe en esta empresa",
      );
    }
    if (fields.includes("email") || fields.includes("business_email")) {
      throw new AppError(
        409,
        "duplicate_email",
        "El correo ya existe en esta empresa",
      );
    }
    if (fields.includes("user_id")) {
      throw new AppError(
        409,
        "user_already_linked",
        "Ese usuario ya está vinculado a otro tripulante",
      );
    }
    throw new AppError(409, "duplicate", "Registro duplicado");
  }
  throw err;
}

/** Lista tripulantes paginados. */
export async function listCrewMembers(
  actor: Actor,
  query: ListCrewMembersQuery,
): Promise<{
  items: CrewMemberResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await Promise.all([
    prisma.crewMember.count({ where }),
    prisma.crewMember.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.limit,
    }),
  ]);

  const compliance = await computeCourseCompliancePercents(
    rows.map((row) => ({
      id: row.id,
      competencyCertificateId: row.competencyCertificateId,
    })),
  );

  return {
    items: rows.map((row) =>
      toCrewMemberResponse(row, compliance.get(row.id) ?? null),
    ),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (scoped). */
export async function getCrewMemberById(
  actor: Actor,
  id: string,
): Promise<CrewMemberResponse> {
  const row = await prisma.crewMember.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
  assertCrewTenantAccess(actor, row.businessId);
  return toCrewMemberResponseWithCompliance(row);
}

/** Alta de tripulante con validación de FKs. */
export async function createCrewMember(
  actor: Actor,
  body: CreateCrewMemberBody,
): Promise<CrewMemberResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const areaId = body.areaId ?? null;
  const rankId = body.rankId ?? null;
  const academicDegreeId = body.academicDegreeId ?? null;
  const competencyCertificateId = body.competencyCertificateId ?? null;
  const userId = body.userId ?? null;

  await assertCrewFks({
    businessId,
    locationId: body.locationId,
    areaId,
    rankId,
    academicDegreeId,
    competencyCertificateId,
    userId,
  });

  try {
    const row = await prisma.crewMember.create({
      data: {
        run: body.run.trim(),
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        nationality: body.nationality ?? null,
        phone: body.phone ?? null,
        direction: body.direction ?? null,
        observation: body.observation ?? null,
        boardingBookValidUntil: new Date(body.boardingBookValidUntil),
        businessId,
        locationId: body.locationId,
        areaId,
        rankId,
        academicDegreeId,
        competencyCertificateId,
        userId,
        state: body.state ?? true,
      },
    });
    // Auto A: si nace con título, carga cursos del título como pending.
    if (competencyCertificateId) {
      await assignCertificateCoursesToCrewMember(
        row.id,
        competencyCertificateId,
      );
    }
    return toCrewMemberResponseWithCompliance(row);
  } catch (err) {
    mapUniqueViolation(err);
  }
}

/** Actualiza ficha; admin no mueve a otra empresa. */
export async function updateCrewMember(
  actor: Actor,
  id: string,
  body: UpdateCrewMemberBody,
): Promise<CrewMemberResponse> {
  const existing = await prisma.crewMember.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
  assertCrewTenantAccess(actor, existing.businessId);

  if (body.businessId !== undefined && actor.internalRol !== "superadmin") {
    if (body.businessId !== actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover el tripulante a otra empresa",
      );
    }
  }

  const nextBusinessId = body.businessId ?? existing.businessId;
  const nextLocationId = body.locationId ?? existing.locationId;
  const nextAreaId =
    body.areaId !== undefined ? body.areaId : existing.areaId;
  const nextRankId =
    body.rankId !== undefined ? body.rankId : existing.rankId;
  const nextDegreeId =
    body.academicDegreeId !== undefined
      ? body.academicDegreeId
      : existing.academicDegreeId;
  const nextCertId =
    body.competencyCertificateId !== undefined
      ? body.competencyCertificateId
      : existing.competencyCertificateId;
  const nextUserId =
    body.userId !== undefined ? body.userId : existing.userId;

  await assertCrewFks({
    businessId: nextBusinessId,
    locationId: nextLocationId,
    areaId: nextAreaId,
    rankId: nextRankId,
    academicDegreeId: nextDegreeId,
    competencyCertificateId: nextCertId,
    userId: nextUserId,
    excludeCrewId: existing.id,
  });

  const data: Prisma.CrewMemberUpdateInput = {};
  if (body.run !== undefined) data.run = body.run.trim();
  if (body.firstName !== undefined) data.firstName = body.firstName;
  if (body.lastName !== undefined) data.lastName = body.lastName;
  if (body.email !== undefined) data.email = body.email;
  if (body.birthDate !== undefined) {
    data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  }
  if (body.nationality !== undefined) data.nationality = body.nationality;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.direction !== undefined) data.direction = body.direction;
  if (body.observation !== undefined) data.observation = body.observation;
  if (body.boardingBookValidUntil !== undefined) {
    data.boardingBookValidUntil = new Date(body.boardingBookValidUntil);
  }
  if (body.state !== undefined) data.state = body.state;

  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }
  if (nextLocationId !== existing.locationId) {
    data.location = { connect: { id: nextLocationId } };
  }
  if (body.areaId !== undefined) {
    data.area =
      body.areaId === null
        ? { disconnect: true }
        : { connect: { id: body.areaId } };
  }
  if (body.rankId !== undefined) {
    data.rank =
      body.rankId === null
        ? { disconnect: true }
        : { connect: { id: body.rankId } };
  }
  if (body.academicDegreeId !== undefined) {
    data.academicDegree =
      body.academicDegreeId === null
        ? { disconnect: true }
        : { connect: { id: body.academicDegreeId } };
  }
  if (body.competencyCertificateId !== undefined) {
    data.competencyCertificate =
      body.competencyCertificateId === null
        ? { disconnect: true }
        : { connect: { id: body.competencyCertificateId } };
  }
  if (body.userId !== undefined) {
    data.user =
      body.userId === null
        ? { disconnect: true }
        : { connect: { id: body.userId } };
  }

  const certificateChanged =
    body.competencyCertificateId !== undefined &&
    (existing.competencyCertificateId ?? null) !== (nextCertId ?? null);

  try {
    const updated = await prisma.crewMember.update({
      where: { id },
      data,
    });
    // Auto A: al cambiar título, quita gestionados del anterior y crea del nuevo.
    if (certificateChanged) {
      await reconcileCrewMemberCertificateCourses(updated.id, nextCertId);
    }
    return toCrewMemberResponseWithCompliance(updated);
  } catch (err) {
    mapUniqueViolation(err);
  }
}

/**
 * Soft delete de tripulante.
 * Desvincula userId; si el usuario vinculado es User/Colaborador,
 * lo desactiva (state=false + tokenVersion++) para que no siga entrando.
 * No toca admin/rrhh/otros roles ni borra la fila de users.
 */
export async function deleteCrewMemberById(
  actor: Actor,
  id: string,
): Promise<CrewMemberResponse> {
  const existing = await prisma.crewMember.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
  assertCrewTenantAccess(actor, existing.businessId);

  const linkedUserId = existing.userId;

  const deleted = await prisma.$transaction(async (tx) => {
    const row = await tx.crewMember.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        state: false,
        user: { disconnect: true },
      },
    });

    if (linkedUserId) {
      const linked = await tx.user.findFirst({
        where: { id: linkedUserId, deletedAt: null },
        select: { id: true, internalRol: true },
      });
      // Solo cuentas de nave (Acceso); no desactivar admin u otros roles.
      if (
        linked &&
        ACCESS_ROLE_KEYS.includes(linked.internalRol as AccessRoleKey)
      ) {
        await tx.user.update({
          where: { id: linked.id },
          data: {
            state: false,
            tokenVersion: { increment: 1 },
          },
        });
      }
    }

    return row;
  });

  return toCrewMemberResponse(deleted);
}

/** Etiqueta corta del dataScope para UI Acceso. */
function dataScopeLabel(scope: RoleDataScope | null | undefined): string {
  switch (scope) {
    case "all":
      return "Sistema";
    case "business":
      return "Empresa";
    case "location":
      return "Nave / lugar";
    case "area":
      return "Área";
    case "self":
      return "Propio";
    default:
      return "—";
  }
}

/**
 * Serializa el estado Acceso a partir del tripulante + usuario vinculado.
 * Si no hay userId, linked=false (empty state D44b).
 */
async function toCrewAccessResponse(
  crew: CrewMember,
): Promise<CrewAccessResponse> {
  if (!crew.userId) {
    return {
      linked: false,
      invitePending: false,
      scopeSummary: null,
      user: null,
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: crew.userId, deletedAt: null },
    include: {
      role: true,
      location: { select: { id: true, name: true } },
    },
  });

  // FK huérfana: tratar como no vinculado para no romper la ficha.
  if (!user) {
    return {
      linked: false,
      invitePending: false,
      scopeSummary: null,
      user: null,
    };
  }

  const roleKey = user.role?.key ?? null;
  const roleName = user.role?.name ?? null;
  const dataScope = user.role?.dataScope ?? null;
  const locationName = user.location?.name ?? null;
  const scopeParts = [
    roleName ?? user.internalRol,
    locationName ?? dataScopeLabel(dataScope),
  ].filter(Boolean);
  const scopeSummary = scopeParts.join(" · ") || null;

  return {
    linked: true,
    invitePending: !user.confirmed,
    scopeSummary,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      run: user.run,
      internalRol: user.internalRol,
      roleKey,
      roleName,
      dataScope,
      locationId: user.locationId,
      locationName,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      confirmed: user.confirmed,
      state: user.state,
    },
  };
}

/** Carga tripulante activo con chequeo de tenant; 404 si no existe o sin acceso. */
async function loadCrewForAccess(
  actor: Actor,
  crewMemberId: string,
): Promise<CrewMember> {
  const crew = await prisma.crewMember.findFirst({
    where: { id: crewMemberId, deletedAt: null },
  });
  if (!crew) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
  assertCrewTenantAccess(actor, crew.businessId);
  return crew;
}

/** Resuelve el Role de sistema user|colaborador por key. */
async function resolveAccessRole(roleKey: AccessRoleKey) {
  const role = await prisma.role.findFirst({
    where: { key: roleKey, deletedAt: null, state: true },
  });
  if (!role) {
    throw new AppError(
      500,
      "role_missing",
      `Rol de sistema "${roleKey}" no encontrado`,
    );
  }
  return role;
}

/**
 * Username a partir del local-part del email; asegura unicidad con sufijo.
 * Solo [a-z0-9._-] para no chocar con validaciones de alta admin.
 */
async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const local = email.split("@")[0] ?? "user";
  const base = local
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24) || "user";

  for (let i = 0; i < 8; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await prisma.user.findFirst({
      where: { username: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  // Último recurso: base + hex corto.
  return `${base}${randomBytes(3).toString("hex")}`;
}

/** Contraseña temporal fuerte; el usuario la cambia con el enlace de invitación. */
function generateInvitePassword(): string {
  // Prefijo fijo cumple mayúscula/minúscula/número; el hex aporta entropía.
  return `Wave${randomBytes(9).toString("hex")}9a`;
}

/** GET Acceso: estado de vinculación tripulante ↔ usuario. */
export async function getCrewMemberAccess(
  actor: Actor,
  crewMemberId: string,
): Promise<CrewAccessResponse> {
  const crew = await loadCrewForAccess(actor, crewMemberId);
  return toCrewAccessResponse(crew);
}

/**
 * POST Acceso: otorga acceso al portal (Figma D45).
 * - Si el email ya tiene usuario en la empresa → vincula (1:1).
 * - Si no → crea usuario confirmed=false, rol User/Colaborador, envía reset.
 */
export async function grantCrewMemberAccess(
  actor: Actor,
  crewMemberId: string,
  body: GrantCrewMemberAccessBody,
): Promise<CrewAccessResponse> {
  const crew = await loadCrewForAccess(actor, crewMemberId);

  if (crew.userId) {
    throw new AppError(
      409,
      "already_linked",
      "Este tripulante ya tiene una cuenta vinculada",
    );
  }

  const email = (body.email ?? crew.email).trim().toLowerCase();
  const roleKey = (body.roleKey ?? "user") as AccessRoleKey;
  const role = await resolveAccessRole(roleKey);

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existing) {
    // No vincular cuentas de otra empresa ni superadmin.
    if (
      existing.internalRol === "superadmin" ||
      (existing.businessId && existing.businessId !== crew.businessId)
    ) {
      throw new AppError(
        409,
        "email_other_tenant",
        "Ese correo ya pertenece a un usuario de otra empresa",
      );
    }

    const linkedElsewhere = await prisma.crewMember.findFirst({
      where: { userId: existing.id, deletedAt: null },
      select: { id: true },
    });
    if (linkedElsewhere) {
      throw new AppError(
        409,
        "user_already_linked",
        "Ese usuario ya está vinculado a otro tripulante",
      );
    }

    // Alinea tenant/rol de nave si faltaba; no pisa un rol admin existente.
    const canDowngradeToAccessRole = ACCESS_ROLE_KEYS.includes(
      existing.internalRol as AccessRoleKey,
    );

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          businessId: existing.businessId ?? crew.businessId,
          locationId: existing.locationId ?? crew.locationId,
          ...(canDowngradeToAccessRole
            ? { roleId: role.id, internalRol: role.key }
            : {}),
        },
      });
      await tx.crewMember.update({
        where: { id: crew.id },
        data: { userId: existing.id },
      });
    });

    // Si aún no confirmó, reenvía el enlace de clave.
    if (!existing.confirmed) {
      await requestPasswordReset(existing.email);
    }

    const updated = await prisma.crewMember.findFirstOrThrow({
      where: { id: crew.id },
    });
    return toCrewAccessResponse(updated);
  }

  // Alta nueva: RUN del tripulante no puede estar ya en users.
  const runTaken = await prisma.user.findFirst({
    where: { run: crew.run, deletedAt: null },
    select: { id: true },
  });
  if (runTaken) {
    throw new AppError(
      409,
      "duplicate_run",
      "Ya existe un usuario con el RUN de este tripulante",
    );
  }

  const username = await uniqueUsernameFromEmail(email);
  const passwordHash = await hashPassword(generateInvitePassword());

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        username,
        passwordHash,
        firstName: crew.firstName,
        lastName: crew.lastName,
        run: crew.run,
        confirmed: false,
        state: true,
        internalRol: role.key,
        roleId: role.id,
        businessId: crew.businessId,
        locationId: crew.locationId,
        areaId: crew.areaId,
      },
    });
    await tx.crewMember.update({
      where: { id: crew.id },
      data: { userId: created.id },
    });
  });

  await requestPasswordReset(email);

  const updated = await prisma.crewMember.findFirstOrThrow({
    where: { id: crew.id },
  });
  return toCrewAccessResponse(updated);
}

/**
 * PATCH Acceso: cambia rol User ↔ Colaborador (Figma D46).
 * Solo aplica si ya hay cuenta vinculada.
 */
export async function changeCrewMemberAccessRole(
  actor: Actor,
  crewMemberId: string,
  body: ChangeCrewMemberAccessRoleBody,
): Promise<CrewAccessResponse> {
  const crew = await loadCrewForAccess(actor, crewMemberId);

  if (!crew.userId) {
    throw new AppError(
      400,
      "not_linked",
      "Este tripulante no tiene cuenta vinculada",
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: crew.userId, deletedAt: null },
  });
  if (!user) {
    throw new AppError(404, "user_not_found", "Usuario vinculado no encontrado");
  }

  // Solo se puede rotar entre user y colaborador (no admin/rrhh/…).
  if (!ACCESS_ROLE_KEYS.includes(user.internalRol as AccessRoleKey)) {
    throw new AppError(
      400,
      "role_not_swappable",
      "Solo se puede cambiar el rol entre User y Colaborador",
    );
  }

  const role = await resolveAccessRole(body.roleKey);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      roleId: role.id,
      internalRol: role.key,
      // Colaborador/User operan a nivel nave: alinea location al tripulante.
      locationId: user.locationId ?? crew.locationId,
    },
  });

  return toCrewAccessResponse(crew);
}

/**
 * DELETE Acceso: desvincula la cuenta (Figma D44m).
 * No borra ni desactiva el usuario; solo quita crew.userId.
 */
export async function revokeCrewMemberAccess(
  actor: Actor,
  crewMemberId: string,
): Promise<CrewAccessResponse> {
  const crew = await loadCrewForAccess(actor, crewMemberId);

  if (!crew.userId) {
    throw new AppError(
      400,
      "not_linked",
      "Este tripulante no tiene cuenta vinculada",
    );
  }

  const updated = await prisma.crewMember.update({
    where: { id: crew.id },
    data: { user: { disconnect: true } },
  });

  return toCrewAccessResponse(updated);
}
