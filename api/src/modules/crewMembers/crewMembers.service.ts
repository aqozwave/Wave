import { randomBytes } from "node:crypto";
import { Prisma, type CrewMember, type RoleDataScope } from "@prisma/client";
import {
  applyDataScopeToWhere,
  assertDataScopeAccess,
} from "../../lib/dataScope.js";
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
import { createCrewMemberDocument } from "../crewMemberDocuments/crewMemberDocuments.service.js";
import type {
  ChangeCrewMemberAccessRoleBody,
  CreateCrewMemberBody,
  CreateCrewMemberLogEntryBody,
  CrewAccessResponse,
  CrewHistoryItem,
  CrewMemberLogEntryResponse,
  CrewMemberResponse,
  GrantCrewMemberAccessBody,
  ListCrewMemberHistoryQuery,
  ListCrewMembersQuery,
  UpdateCrewMemberBody,
} from "./crewMembers.schemas.js";

/**
 * Actor para tenant + dataScope (nave/área) e id/roleId para docs.
 */
type Actor = Pick<
  AuthUser,
  | "id"
  | "internalRol"
  | "businessId"
  | "locationId"
  | "areaId"
  | "organizationId"
  | "dataScope"
  | "roleId"
>;

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

/**
 * Filtro de listado según dataScope.
 * location → solo su nave (ignora query.locationId de otra nave).
 * Superadmin: opcional businessId / locationId de query.
 */
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

  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    if (query.businessId) base.businessId = query.businessId;
    if (query.locationId) base.locationId = query.locationId;
    return base;
  }

  /** Alcance location/area: no dejar filtrar otra nave por query. */
  const scoped = applyDataScopeToWhere(actor, base, {
    locationField: "locationId",
    areaField: "areaId",
  });

  if (
    (actor.dataScope === "business" || actor.dataScope == null) &&
    query.locationId
  ) {
    scoped.locationId = query.locationId;
  }

  return scoped;
}

/** 404/403 si el actor no puede ver ese tripulante (empresa + nave/área). */
function assertCrewTenantAccess(
  actor: Actor,
  row: { businessId: string; locationId: string; areaId: string | null },
): void {
  assertDataScopeAccess(actor, row, {
    code: "crew_member_not_found",
    message: "Tripulante no encontrado",
  });
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
  assertCrewTenantAccess(actor, row);
  return toCrewMemberResponseWithCompliance(row);
}

/**
 * dataScope location: fuerza la nave del actor (no crear/mover a otra).
 */
function resolveScopedLocationId(
  actor: Actor,
  requestedLocationId: string,
): string {
  if (actor.dataScope === "location") {
    if (!actor.locationId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una nave asignada",
      );
    }
    if (requestedLocationId !== actor.locationId) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes asignar tripulantes a otra nave",
      );
    }
    return actor.locationId;
  }
  return requestedLocationId;
}

/** Alta de tripulante con validación de FKs. */
export async function createCrewMember(
  actor: Actor,
  body: CreateCrewMemberBody,
): Promise<CrewMemberResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const locationId = resolveScopedLocationId(actor, body.locationId);
  const areaId = body.areaId ?? null;
  const rankId = body.rankId ?? null;
  const academicDegreeId = body.academicDegreeId ?? null;
  const competencyCertificateId = body.competencyCertificateId ?? null;
  const userId = body.userId ?? null;

  await assertCrewFks({
    businessId,
    locationId,
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
        locationId,
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

/**
 * Compara dos fechas opcionales por instante (ISO / Date / null).
 * Evita marcar boardingBookValidUntil como cambiado por reenvío del form.
 */
function sameOptionalInstant(
  a: Date | null,
  bIso: string | null | undefined,
): boolean {
  if (bIso === undefined) return true;
  if (a === null && (bIso === null || bIso === "")) return true;
  if (a === null || bIso === null || bIso === "") return false;
  return a.getTime() === new Date(bIso).getTime();
}

/** Resultado de PATCH ficha: crew + campos que realmente cambiaron (auditoría). */
export type UpdateCrewMemberResult = {
  crew: CrewMemberResponse;
  changedFields: string[];
};

/** Actualiza ficha; admin no mueve a otra empresa. */
export async function updateCrewMember(
  actor: Actor,
  id: string,
  body: UpdateCrewMemberBody,
): Promise<UpdateCrewMemberResult> {
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
  assertCrewTenantAccess(actor, existing);

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
  const nextLocationId = resolveScopedLocationId(
    actor,
    body.locationId ?? existing.locationId,
  );
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
  /** Solo claves cuyo valor efectivo difiere (no el body completo). */
  const changedFields: string[] = [];

  if (body.run !== undefined) {
    const next = body.run.trim();
    if (next !== existing.run) {
      data.run = next;
      changedFields.push("run");
    }
  }
  if (body.firstName !== undefined && body.firstName !== existing.firstName) {
    data.firstName = body.firstName;
    changedFields.push("firstName");
  }
  if (body.lastName !== undefined && body.lastName !== existing.lastName) {
    data.lastName = body.lastName;
    changedFields.push("lastName");
  }
  if (body.email !== undefined && body.email !== existing.email) {
    data.email = body.email;
    changedFields.push("email");
  }
  if (body.birthDate !== undefined) {
    const next = body.birthDate ? new Date(body.birthDate) : null;
    if (!sameOptionalInstant(existing.birthDate, body.birthDate)) {
      data.birthDate = next;
      changedFields.push("birthDate");
    }
  }
  if (
    body.nationality !== undefined &&
    (body.nationality ?? null) !== (existing.nationality ?? null)
  ) {
    data.nationality = body.nationality;
    changedFields.push("nationality");
  }
  if (
    body.phone !== undefined &&
    (body.phone ?? null) !== (existing.phone ?? null)
  ) {
    data.phone = body.phone;
    changedFields.push("phone");
  }
  if (
    body.direction !== undefined &&
    (body.direction ?? null) !== (existing.direction ?? null)
  ) {
    data.direction = body.direction;
    changedFields.push("direction");
  }
  if (
    body.observation !== undefined &&
    (body.observation ?? null) !== (existing.observation ?? null)
  ) {
    data.observation = body.observation;
    changedFields.push("observation");
  }
  if (body.boardingBookValidUntil !== undefined) {
    if (
      !sameOptionalInstant(
        existing.boardingBookValidUntil,
        body.boardingBookValidUntil,
      )
    ) {
      data.boardingBookValidUntil = new Date(body.boardingBookValidUntil);
      changedFields.push("boardingBookValidUntil");
    }
  }
  if (body.state !== undefined && body.state !== existing.state) {
    data.state = body.state;
    changedFields.push("state");
  }

  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
    changedFields.push("businessId");
  }
  if (nextLocationId !== existing.locationId) {
    data.location = { connect: { id: nextLocationId } };
    changedFields.push("locationId");
  }
  if (body.areaId !== undefined && (body.areaId ?? null) !== (existing.areaId ?? null)) {
    data.area =
      body.areaId === null
        ? { disconnect: true }
        : { connect: { id: body.areaId } };
    changedFields.push("areaId");
  }
  if (body.rankId !== undefined && (body.rankId ?? null) !== (existing.rankId ?? null)) {
    data.rank =
      body.rankId === null
        ? { disconnect: true }
        : { connect: { id: body.rankId } };
    changedFields.push("rankId");
  }
  if (
    body.academicDegreeId !== undefined &&
    (body.academicDegreeId ?? null) !== (existing.academicDegreeId ?? null)
  ) {
    data.academicDegree =
      body.academicDegreeId === null
        ? { disconnect: true }
        : { connect: { id: body.academicDegreeId } };
    changedFields.push("academicDegreeId");
  }
  if (
    body.competencyCertificateId !== undefined &&
    (body.competencyCertificateId ?? null) !==
      (existing.competencyCertificateId ?? null)
  ) {
    data.competencyCertificate =
      body.competencyCertificateId === null
        ? { disconnect: true }
        : { connect: { id: body.competencyCertificateId } };
    changedFields.push("competencyCertificateId");
  }
  if (body.userId !== undefined && (body.userId ?? null) !== (existing.userId ?? null)) {
    data.user =
      body.userId === null
        ? { disconnect: true }
        : { connect: { id: body.userId } };
    changedFields.push("userId");
  }

  const certificateChanged = changedFields.includes("competencyCertificateId");

  try {
    // Sin cambios efectivos: no escribe ni dispara reconcile.
    if (changedFields.length === 0) {
      return {
        crew: await toCrewMemberResponseWithCompliance(existing),
        changedFields: [],
      };
    }
    const updated = await prisma.crewMember.update({
      where: { id },
      data,
    });
    // Auto A: al cambiar título, quita gestionados del anterior y crea del nuevo.
    if (certificateChanged) {
      await reconcileCrewMemberCertificateCourses(updated.id, nextCertId);
    }
    return {
      crew: await toCrewMemberResponseWithCompliance(updated),
      changedFields,
    };
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
  assertCrewTenantAccess(actor, existing);

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
  assertCrewTenantAccess(actor, crew);
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

/** Categoría de timeline (sin "all"). */
type CrewHistoryCategory = Exclude<
  ListCrewMemberHistoryQuery["category"],
  "all" | undefined
>;

/** Mapea action/resource/metadata → categoría e ítem legible. */
function mapCrewAuditEvent(row: {
  id: string;
  action: string;
  resource: string;
  targetLabel: string | null;
  actorUsername: string | null;
  actorEmail: string | null;
  success: boolean;
  metadata: unknown;
  createdAt: Date;
}): CrewHistoryItem | null {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const fields = Array.isArray(meta.fields)
    ? meta.fields.map(String)
    : [];
  const actor = row.actorUsername || row.actorEmail || null;

  let category: CrewHistoryCategory = "contract";
  let categoryLabel = "Contrato";
  let title = row.targetLabel?.trim() || "Evento de ficha";
  let statusLabel: string | null = row.success ? "OK" : "Error";
  let statusTone: CrewHistoryItem["statusTone"] = row.success
    ? "success"
    : "danger";

  const metaKind = typeof meta.kind === "string" ? meta.kind : null;

  // Alta/baja de log entries ya viven en crew_member_log_entries (evitar duplicar).
  if (metaKind === "crew_member_log_entry") {
    return null;
  }

  // Capacitaciones Prevención asignadas a la ficha (audit con kind en metadata).
  if (
    metaKind === "crew_member_training" ||
    metaKind === "crew_member_training_evidence"
  ) {
    category = "course";
    categoryLabel = "Capacitación";
    const label = row.targetLabel ? `: ${row.targetLabel}` : "";
    if (metaKind === "crew_member_training_evidence") {
      title = `Evidencia de capacitación${label}`;
    } else if (row.action === "CREATE") {
      title = `Capacitación asignada${label}`;
    } else if (row.action === "UPDATE") {
      title = `Capacitación actualizada${label}`;
    } else if (row.action === "DELETE") {
      title = `Capacitación quitada${label}`;
    } else {
      title = `Capacitación${label}`;
    }
    statusTone = "info";
    statusLabel = "Capacitación";
  } else if (row.resource === "crewMemberCourse") {
    category = "course";
    categoryLabel = "Curso";
    if (row.action === "CREATE") title = `Curso asignado${row.targetLabel ? `: ${row.targetLabel}` : ""}`;
    else if (row.action === "UPDATE") title = `Curso actualizado${row.targetLabel ? `: ${row.targetLabel}` : ""}`;
    else if (row.action === "DELETE") title = `Curso eliminado${row.targetLabel ? `: ${row.targetLabel}` : ""}`;
    statusTone = "info";
    statusLabel = "Curso";
  } else if (row.action === "CREATE" && row.resource === "crewMember") {
    category = "contract";
    categoryLabel = "Ingreso";
    title = "Ingreso al sistema";
    statusLabel = "Ingreso";
    statusTone = "success";
  } else if (fields.includes("locationId")) {
    category = "boarding";
    categoryLabel = "Embarque";
    title = "Cambio de nave / ubicación";
    statusLabel = "Embarque";
    statusTone = "info";
  } else if (fields.includes("observation")) {
    category = "observation";
    categoryLabel = "Observación";
    title = "Observación de ficha actualizada";
    statusLabel = "Observación";
    statusTone = "warning";
  } else if (row.action === "UPDATE") {
    category = "contract";
    categoryLabel = "Contrato";
    title = "Datos de ficha actualizados";
    if (fields.length > 0) {
      title = `Actualización: ${fields.slice(0, 4).join(", ")}`;
    }
    statusLabel = "Actualización";
    statusTone = "neutral";
  } else if (row.action === "DELETE") {
    category = "contract";
    categoryLabel = "Contrato";
    title = "Tripulante desactivado";
    statusLabel = "Baja";
    statusTone = "danger";
  }

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    title,
    detail: row.targetLabel,
    category,
    categoryLabel,
    statusLabel,
    statusTone,
    actor,
    attachmentName: null,
    source: "audit",
  };
}

/** Etiquetas UI por kind de entrada manual. */
const LOG_ENTRY_LABELS: Record<
  "observation" | "sanction" | "boarding",
  { categoryLabel: string; title: string; statusLabel: string; statusTone: CrewHistoryItem["statusTone"] }
> = {
  observation: {
    categoryLabel: "Observación",
    title: "Observación",
    statusLabel: "Observación",
    statusTone: "warning",
  },
  sanction: {
    categoryLabel: "Amonestación",
    title: "Amonestación",
    statusLabel: "Amonestación",
    statusTone: "warning",
  },
  boarding: {
    categoryLabel: "Embarque",
    title: "Embarque",
    statusLabel: "Embarque",
    statusTone: "info",
  },
};

/** Serializa fila de log entry → contrato API. */
function toLogEntryResponse(row: {
  id: string;
  crewMemberId: string;
  kind: "observation" | "sanction" | "boarding";
  note: string;
  occurredAt: Date;
  documentId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CrewMemberLogEntryResponse {
  return {
    id: row.id,
    crewMemberId: row.crewMemberId,
    kind: row.kind,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    documentId: row.documentId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** POST entrada manual de bitácora (observación / amonestación / embarque). */
export async function createCrewMemberLogEntry(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberLogEntryBody,
): Promise<CrewMemberLogEntryResponse> {
  await getCrewMemberById(actor, crewMemberId);

  const occurredAt = body.occurredAt
    ? new Date(body.occurredAt)
    : new Date();

  /** Adjunto: crea doc del expediente y lo vincula (solo sanction, validado en Zod). */
  let documentId: string | null = null;
  if (body.attachment && body.kind === "sanction") {
    const doc = await createCrewMemberDocument(actor, crewMemberId, {
      documentTypeId: body.attachment.documentTypeId,
      fileName: body.attachment.fileName,
      mimeType: body.attachment.mimeType,
      contentBase64: body.attachment.contentBase64,
      expiresAt: body.attachment.expiresAt,
      sourceModule: "crew",
    });
    documentId = doc.id;
  }

  const row = await prisma.crewMemberLogEntry.create({
    data: {
      crewMemberId,
      kind: body.kind,
      note: body.note.trim(),
      occurredAt,
      createdById: actor.id,
      documentId,
    },
  });

  return toLogEntryResponse(row);
}

/** Soft delete de una entrada manual de bitácora. */
export async function deleteCrewMemberLogEntry(
  actor: Actor,
  crewMemberId: string,
  entryId: string,
): Promise<CrewMemberLogEntryResponse> {
  await getCrewMemberById(actor, crewMemberId);

  const existing = await prisma.crewMemberLogEntry.findFirst({
    where: { id: entryId, crewMemberId, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "log_entry_not_found",
      "Entrada de bitácora no encontrada",
    );
  }

  const row = await prisma.crewMemberLogEntry.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  return toLogEntryResponse(row);
}

/**
 * Bitácora del tripulante (Figma D31 / AQO-68).
 * Une activity_logs, documentos y entradas manuales (log entries).
 */
export async function listCrewMemberHistory(
  actor: Actor,
  crewMemberId: string,
  query: ListCrewMemberHistoryQuery,
): Promise<{
  items: CrewHistoryItem[];
  summary: {
    documents: number;
    courses: number;
    boardings: number;
    observations: number;
    sanctions: number;
    total: number;
  };
  total: number;
  page: number;
  limit: number;
}> {
  await getCrewMemberById(actor, crewMemberId);

  const courseRows = await prisma.crewMemberCourse.findMany({
    where: { crewMemberId },
    select: { id: true },
  });
  const courseIds = courseRows.map((c) => c.id);

  const orFilters: Prisma.ActivityLogWhereInput[] = [
    { resource: "crewMember", resourceId: crewMemberId },
    // Asignaciones auditadas antes del fix (resource=training + metadata.crewMemberId).
    {
      resource: "training",
      metadata: { path: ["crewMemberId"], equals: crewMemberId },
    },
  ];
  if (courseIds.length > 0) {
    orFilters.push({
      resource: "crewMemberCourse",
      resourceId: { in: courseIds },
    });
  }

  const [documents, auditRows, logEntries] = await Promise.all([
    prisma.crewMemberDocument.findMany({
      where: { crewMemberId, deletedAt: null },
      include: {
        documentType: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.activityLog.findMany({
      where: { OR: orFilters },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.crewMemberLogEntry.findMany({
      where: { crewMemberId, deletedAt: null },
      include: {
        createdBy: { select: { username: true, email: true } },
        document: {
          select: { originalName: true, deletedAt: true },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);

  const docEvents: CrewHistoryItem[] = documents.map((doc) => ({
    id: `doc:${doc.id}`,
    createdAt: doc.createdAt.toISOString(),
    title: `${doc.documentType.name} subido`,
    detail: doc.documentType.code,
    category: "document" as const,
    categoryLabel: "Documento",
    statusLabel: "Documento",
    statusTone: "info" as const,
    actor: null,
    attachmentName: doc.originalName,
    source: "document" as const,
  }));

  const auditEvents = auditRows
    .map(mapCrewAuditEvent)
    .filter((e): e is CrewHistoryItem => e !== null);

  const logEvents: CrewHistoryItem[] = logEntries.map((entry) => {
    const labels = LOG_ENTRY_LABELS[entry.kind];
    const attachmentName =
      entry.document && !entry.document.deletedAt
        ? entry.document.originalName
        : null;
    return {
      id: entry.id,
      createdAt: entry.occurredAt.toISOString(),
      title: labels.title,
      detail: entry.note,
      category: entry.kind,
      categoryLabel: labels.categoryLabel,
      statusLabel: labels.statusLabel,
      statusTone: labels.statusTone,
      actor: entry.createdBy?.username || entry.createdBy?.email || null,
      attachmentName,
      source: "log_entry" as const,
    };
  });

  /** Merge + orden cronológico desc. */
  let merged = [...docEvents, ...auditEvents, ...logEvents].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const summary = {
    documents: merged.filter((e) => e.category === "document").length,
    courses: merged.filter((e) => e.category === "course").length,
    boardings: merged.filter((e) => e.category === "boarding").length,
    observations: merged.filter((e) => e.category === "observation").length,
    sanctions: merged.filter((e) => e.category === "sanction").length,
    total: merged.length,
  };

  const category = query.category ?? "all";
  if (category !== "all") {
    merged = merged.filter((e) => e.category === category);
  }

  const total = merged.length;
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;
  const items = merged.slice(skip, skip + limit);

  return { items, summary, total, page, limit };
}
