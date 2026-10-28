import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateCrewMemberMuelleBody,
  CreateCrewMemberTravesiaBody,
  CrewMemberMuelleResponse,
  CrewMemberTravesiaResponse,
} from "./crewMemberAssignments.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** 404 genérico si no ve la empresa. */
function assertCrewTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
}

/** Tripulante activo + tenant. */
async function loadCrewForActor(actor: Actor, crewMemberId: string) {
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

/**
 * Solo capitán / primer piloto (officerKind del certificado) pueden recibir
 * muelles o travesías. El resto de títulos no aplica.
 */
async function assertCrewCanReceiveOfficerAssignments(
  crew: Awaited<ReturnType<typeof loadCrewForActor>>,
): Promise<void> {
  if (!crew.competencyCertificateId) {
    throw new AppError(
      403,
      "officer_assignments_not_allowed",
      "Solo tripulantes con certificado de capitán o primer piloto pueden tener muelles o travesías",
    );
  }

  const cert = await prisma.competencyCertificate.findFirst({
    where: { id: crew.competencyCertificateId, deletedAt: null },
    select: { officerKind: true },
  });

  if (
    !cert ||
    (cert.officerKind !== "captain" && cert.officerKind !== "first_pilot")
  ) {
    throw new AppError(
      403,
      "officer_assignments_not_allowed",
      "Solo tripulantes con certificado de capitán o primer piloto pueden tener muelles o travesías",
    );
  }
}

/** Lista muelles asignados (activos). */
export async function listCrewMemberMuelles(
  actor: Actor,
  crewMemberId: string,
): Promise<{ items: CrewMemberMuelleResponse[]; total: number }> {
  await loadCrewForActor(actor, crewMemberId);

  const rows = await prisma.crewMemberMuelle.findMany({
    where: { crewMemberId, deletedAt: null },
    include: { muelle: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      legacyMongoId: row.legacyMongoId,
      crewMemberId: row.crewMemberId,
      muelleId: row.muelleId,
      muelleName: row.muelle.name,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: rows.length,
  };
}

/** Asigna un muelle de la misma empresa (solo oficiales). */
export async function createCrewMemberMuelle(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberMuelleBody,
): Promise<CrewMemberMuelleResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  await assertCrewCanReceiveOfficerAssignments(crew);

  const muelle = await prisma.muelle.findFirst({
    where: { id: body.muelleId, deletedAt: null, state: true },
  });
  if (!muelle || muelle.businessId !== crew.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "Muelle no encontrado en la empresa del tripulante",
    );
  }

  try {
    const row = await prisma.crewMemberMuelle.create({
      data: {
        crewMemberId: crew.id,
        muelleId: muelle.id,
      },
      include: { muelle: { select: { name: true } } },
    });
    return {
      id: row.id,
      legacyMongoId: row.legacyMongoId,
      crewMemberId: row.crewMemberId,
      muelleId: row.muelleId,
      muelleName: row.muelle.name,
      deletedAt: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_assignment",
        "Ese muelle ya está asignado a este tripulante",
      );
    }
    throw err;
  }
}

/** Soft delete de asignación muelle. */
export async function deleteCrewMemberMuelle(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberMuelleResponse> {
  await loadCrewForActor(actor, crewMemberId);

  const existing = await prisma.crewMemberMuelle.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: { muelle: { select: { name: true } } },
  });
  if (!existing) {
    throw new AppError(
      404,
      "assignment_not_found",
      "Asignación no encontrada",
    );
  }

  const row = await prisma.crewMemberMuelle.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
    include: { muelle: { select: { name: true } } },
  });

  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    crewMemberId: row.crewMemberId,
    muelleId: row.muelleId,
    muelleName: row.muelle.name,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lista travesías asignadas (activas). */
export async function listCrewMemberTravesias(
  actor: Actor,
  crewMemberId: string,
): Promise<{ items: CrewMemberTravesiaResponse[]; total: number }> {
  await loadCrewForActor(actor, crewMemberId);

  const rows = await prisma.crewMemberTravesia.findMany({
    where: { crewMemberId, deletedAt: null },
    include: {
      travesia: { select: { name: true, requiredPassages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      legacyMongoId: row.legacyMongoId,
      crewMemberId: row.crewMemberId,
      travesiaId: row.travesiaId,
      travesiaName: row.travesia.name,
      requiredPassages: row.travesia.requiredPassages,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: rows.length,
  };
}

/** Asigna una travesía de la misma empresa (solo oficiales). */
export async function createCrewMemberTravesia(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberTravesiaBody,
): Promise<CrewMemberTravesiaResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  await assertCrewCanReceiveOfficerAssignments(crew);

  const travesia = await prisma.travesia.findFirst({
    where: { id: body.travesiaId, deletedAt: null, state: true },
  });
  if (!travesia || travesia.businessId !== crew.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "Travesía no encontrada en la empresa del tripulante",
    );
  }

  try {
    const row = await prisma.crewMemberTravesia.create({
      data: {
        crewMemberId: crew.id,
        travesiaId: travesia.id,
      },
      include: {
        travesia: { select: { name: true, requiredPassages: true } },
      },
    });
    return {
      id: row.id,
      legacyMongoId: row.legacyMongoId,
      crewMemberId: row.crewMemberId,
      travesiaId: row.travesiaId,
      travesiaName: row.travesia.name,
      requiredPassages: row.travesia.requiredPassages,
      deletedAt: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_assignment",
        "Esa travesía ya está asignada a este tripulante",
      );
    }
    throw err;
  }
}

/** Soft delete de asignación travesía. */
export async function deleteCrewMemberTravesia(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberTravesiaResponse> {
  await loadCrewForActor(actor, crewMemberId);

  const existing = await prisma.crewMemberTravesia.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: {
      travesia: { select: { name: true, requiredPassages: true } },
    },
  });
  if (!existing) {
    throw new AppError(
      404,
      "assignment_not_found",
      "Asignación no encontrada",
    );
  }

  const row = await prisma.crewMemberTravesia.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
    include: {
      travesia: { select: { name: true, requiredPassages: true } },
    },
  });

  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    crewMemberId: row.crewMemberId,
    travesiaId: row.travesiaId,
    travesiaName: row.travesia.name,
    requiredPassages: row.travesia.requiredPassages,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
