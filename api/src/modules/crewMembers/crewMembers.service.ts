import { Prisma, type CrewMember } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateCrewMemberBody,
  CrewMemberResponse,
  ListCrewMembersQuery,
  UpdateCrewMemberBody,
} from "./crewMembers.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toCrewMemberResponse(row: CrewMember): CrewMemberResponse {
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
  };
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

/** Admin → su empresa; superadmin → body.businessId obligatorio. */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateCrewMemberBody,
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

  return {
    items: rows.map(toCrewMemberResponse),
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
  return toCrewMemberResponse(row);
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
    return toCrewMemberResponse(row);
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

  try {
    const updated = await prisma.crewMember.update({
      where: { id },
      data,
    });
    return toCrewMemberResponse(updated);
  } catch (err) {
    mapUniqueViolation(err);
  }
}

/** Soft delete de tripulante. */
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

  const deleted = await prisma.crewMember.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
      user: { disconnect: true },
    },
  });

  return toCrewMemberResponse(deleted);
}
