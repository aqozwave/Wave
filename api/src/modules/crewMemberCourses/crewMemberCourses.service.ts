import type { Course, CrewCourseSource, CrewMemberCourse } from "@prisma/client";
import {
  daysUntilExpiry,
  getCourseExpiryWarningDays,
  resolveAssignmentStatus,
} from "../../lib/crewCourseStatus.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateCrewMemberCourseBody,
  CrewMemberCourseResponse,
  UpdateCrewMemberCourseBody,
} from "./crewMemberCourses.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Fila con curso incluido. */
type AssignmentWithCourse = CrewMemberCourse & { course: Course | null };

/**
 * ¿La fila la gestiona el título (o legacy rank)?
 * Las manuales no se borran al cambiar de título.
 */
export function isCertificateManagedAssignment(row: {
  source: CrewCourseSource;
  status: string;
  completedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (row.source === "certificate") return true;
  if (row.source === "rank") return true;
  if (row.source === "manual") return false;
  return (
    row.status === "pending" &&
    row.completedAt == null &&
    row.expiresAt == null
  );
}

/** 404 genérico si el actor no ve la empresa del tripulante. */
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

/**
 * % de cumplimiento de cursos obligatorios por tripulante (listado Embarcados).
 * Misma regla que CrewCoursesPanel: mandatory con status valid | expiring_soon.
 * null si no tiene cursos obligatorios.
 */
export async function computeCourseCompliancePercents(
  crews: Array<{ id: string; competencyCertificateId: string | null }>,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (crews.length === 0) return result;

  for (const crew of crews) {
    result.set(crew.id, null);
  }

  const crewIds = crews.map((c) => c.id);
  const assignments = await prisma.crewMemberCourse.findMany({
    where: { crewMemberId: { in: crewIds }, deletedAt: null },
    select: {
      crewMemberId: true,
      courseId: true,
      status: true,
      completedAt: true,
      expiresAt: true,
      course: { select: { isMandatory: true, deletedAt: true } },
    },
  });

  const certIds = [
    ...new Set(
      crews
        .map((c) => c.competencyCertificateId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const certLinks =
    certIds.length === 0
      ? []
      : await prisma.competencyCertificateCourse.findMany({
          where: {
            competencyCertificateId: { in: certIds },
            deletedAt: null,
          },
          select: {
            competencyCertificateId: true,
            courseId: true,
            isMandatory: true,
          },
        });

  /** Join título→curso: gana sobre el flag del catálogo. */
  const certMandatory = new Map<string, boolean>();
  for (const link of certLinks) {
    certMandatory.set(
      `${link.competencyCertificateId}:${link.courseId}`,
      link.isMandatory !== false,
    );
  }

  const crewCert = new Map(
    crews.map((c) => [c.id, c.competencyCertificateId] as const),
  );

  /** Acumuladores por tripulante. */
  const totals = new Map<string, { mandatory: number; done: number }>();
  for (const id of crewIds) {
    totals.set(id, { mandatory: 0, done: 0 });
  }

  const warningDays = getCourseExpiryWarningDays();
  const now = new Date();

  for (const row of assignments) {
    if (row.course?.deletedAt) continue;
    const certId = crewCert.get(row.crewMemberId) ?? null;
    const fromCert =
      certId != null
        ? certMandatory.get(`${certId}:${row.courseId}`)
        : undefined;
    const isMandatory =
      fromCert !== undefined
        ? fromCert
        : row.course?.isMandatory !== false;
    if (!isMandatory) continue;

    const status = resolveAssignmentStatus(row, { warningDays, now });
    const bucket = totals.get(row.crewMemberId);
    if (!bucket) continue;
    bucket.mandatory += 1;
    if (status === "valid" || status === "expiring_soon") {
      bucket.done += 1;
    }
  }

  for (const [crewId, bucket] of totals) {
    if (bucket.mandatory === 0) {
      result.set(crewId, null);
    } else {
      result.set(
        crewId,
        Math.round((bucket.done / bucket.mandatory) * 100),
      );
    }
  }

  return result;
}

/**
 * Recalcula y persiste status desactualizado (portal viejo syncStaleAssignmentStatuses).
 * Devuelve cuántas filas cambió. Usado por el generador de avisos S9.
 */
export async function syncStaleAssignmentStatuses(
  options?: {
    crewMemberId?: string;
    warningDays?: number;
    now?: Date;
  },
): Promise<number> {
  const warningDays =
    options?.warningDays ?? getCourseExpiryWarningDays();
  const now = options?.now ?? new Date();

  const rows = await prisma.crewMemberCourse.findMany({
    where: {
      deletedAt: null,
      ...(options?.crewMemberId
        ? { crewMemberId: options.crewMemberId }
        : {}),
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      expiresAt: true,
    },
  });

  let synced = 0;
  for (const row of rows) {
    const nextStatus = resolveAssignmentStatus(row, { warningDays, now });
    if (nextStatus === row.status) continue;
    await prisma.crewMemberCourse.update({
      where: { id: row.id },
      data: { status: nextStatus },
    });
    synced += 1;
  }
  return synced;
}

/** Carga tripulante activo y valida tenant. */
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
 * Resuelve isMandatory: gana el join del título; si no, el flag del catálogo.
 */
async function resolveIsMandatory(
  crewCompetencyCertificateId: string | null,
  courseId: string,
  courseIsMandatory: boolean,
): Promise<{ isMandatory: boolean; mandatorySource: "certificate" | "catalog" }> {
  if (crewCompetencyCertificateId) {
    const link = await prisma.competencyCertificateCourse.findFirst({
      where: {
        competencyCertificateId: crewCompetencyCertificateId,
        courseId,
        deletedAt: null,
      },
      select: { isMandatory: true },
    });
    if (link) {
      return {
        isMandatory: link.isMandatory !== false,
        mandatorySource: "certificate",
      };
    }
  }
  return {
    isMandatory: courseIsMandatory !== false,
    mandatorySource: "catalog",
  };
}

/** Serializa asignación → contrato (status recalculado). */
async function toAssignmentResponse(
  row: AssignmentWithCourse,
  crewCompetencyCertificateId: string | null,
): Promise<CrewMemberCourseResponse> {
  const warningDays = getCourseExpiryWarningDays();
  const status = resolveAssignmentStatus(row, { warningDays });
  const course =
    row.course && row.course.deletedAt === null
      ? {
          id: row.course.id,
          name: row.course.name,
          whereTaught: row.course.whereTaught,
          description: row.course.description,
          isMandatory: row.course.isMandatory,
          state: row.course.state,
        }
      : null;

  const { isMandatory, mandatorySource } = await resolveIsMandatory(
    crewCompetencyCertificateId,
    row.courseId,
    row.course?.isMandatory ?? true,
  );

  return {
    id: row.id,
    crewMemberId: row.crewMemberId,
    courseId: row.courseId,
    course,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    status,
    source: row.source,
    isMandatory,
    mandatorySource,
    daysUntilExpiry: daysUntilExpiry(row.expiresAt),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lista cursos de un tripulante (tenant-aware). */
export async function listCrewMemberCourses(
  actor: Actor,
  crewMemberId: string,
): Promise<{ items: CrewMemberCourseResponse[]; total: number }> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  const rows = await prisma.crewMemberCourse.findMany({
    where: { crewMemberId, deletedAt: null },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    include: { course: true },
  });

  const items: CrewMemberCourseResponse[] = [];
  for (const row of rows) {
    items.push(await toAssignmentResponse(row, crew.competencyCertificateId));
  }
  return { items, total: items.length };
}

/** Detalle de una asignación del tripulante. */
export async function getCrewMemberCourseById(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberCourseResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberCourse.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: { course: true },
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_course_not_found",
      "Asignación de curso no encontrada",
    );
  }

  // Persistimos status recalculado si cambió (alineado al portal viejo).
  const nextStatus = resolveAssignmentStatus(row);
  if (nextStatus !== row.status) {
    const updated = await prisma.crewMemberCourse.update({
      where: { id: row.id },
      data: { status: nextStatus },
      include: { course: true },
    });
    return toAssignmentResponse(updated, crew.competencyCertificateId);
  }

  return toAssignmentResponse(row, crew.competencyCertificateId);
}

/**
 * Alta manual (source=manual). Curso debe ser de la misma empresa y activo.
 */
export async function createCrewMemberCourse(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberCourseBody,
): Promise<CrewMemberCourseResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);

  const course = await prisma.course.findFirst({
    where: { id: body.courseId, deletedAt: null },
  });
  if (!course) {
    throw new AppError(404, "course_not_found", "Curso no encontrado");
  }
  if (course.state === false) {
    throw new AppError(
      400,
      "course_inactive",
      "No se puede asignar un curso inactivo",
    );
  }
  if (course.businessId !== crew.businessId) {
    throw new AppError(
      400,
      "course_business_mismatch",
      "El curso no pertenece a la misma empresa del tripulante",
    );
  }

  const completedAt =
    body.completedAt === undefined || body.completedAt === null
      ? null
      : new Date(body.completedAt);
  const expiresAt =
    body.expiresAt === undefined || body.expiresAt === null
      ? null
      : new Date(body.expiresAt);
  const status = resolveAssignmentStatus({
    completedAt,
    expiresAt,
    status: "pending",
  });

  const existingActive = await prisma.crewMemberCourse.findFirst({
    where: {
      crewMemberId,
      courseId: body.courseId,
      deletedAt: null,
    },
  });
  if (existingActive) {
    throw new AppError(
      409,
      "duplicate_crew_member_course",
      "Este tripulante ya tiene asignado ese curso",
    );
  }

  // Revive soft-delete si existía el par.
  const softDeleted = await prisma.crewMemberCourse.findFirst({
    where: {
      crewMemberId,
      courseId: body.courseId,
      deletedAt: { not: null },
    },
  });

  const row = softDeleted
    ? await prisma.crewMemberCourse.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          source: "manual",
          completedAt,
          expiresAt,
          status,
          lastExpiringEmailAt: null,
          lastExpiredEmailAt: null,
          expiringMilestonesSent: [],
        },
        include: { course: true },
      })
    : await prisma.crewMemberCourse.create({
        data: {
          crewMemberId,
          courseId: body.courseId,
          source: "manual",
          completedAt,
          expiresAt,
          status,
        },
        include: { course: true },
      });

  return toAssignmentResponse(row, crew.competencyCertificateId);
}

/** Actualiza fechas/estado de una asignación. */
export async function updateCrewMemberCourse(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
  body: UpdateCrewMemberCourseBody,
): Promise<CrewMemberCourseResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberCourse.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: { course: true },
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_course_not_found",
      "Asignación de curso no encontrada",
    );
  }

  const { isMandatory, mandatorySource } = await resolveIsMandatory(
    crew.competencyCertificateId,
    row.courseId,
    row.course?.isMandatory ?? true,
  );

  const nextCompletedAt =
    body.completedAt !== undefined
      ? body.completedAt
        ? new Date(body.completedAt)
        : null
      : row.completedAt;
  const nextExpiresAt =
    body.expiresAt !== undefined
      ? body.expiresAt
        ? new Date(body.expiresAt)
        : null
      : row.expiresAt;

  // Cursos obligatorios del título no pueden volver a pending sin fechas.
  if (
    isMandatory &&
    mandatorySource === "certificate" &&
    body.status === "pending" &&
    !nextCompletedAt
  ) {
    throw new AppError(
      400,
      "mandatory_course_pending_forbidden",
      "Los cursos obligatorios del título marítimo no pueden quedar en estado pendiente",
    );
  }

  const status = resolveAssignmentStatus({
    completedAt: nextCompletedAt,
    expiresAt: nextExpiresAt,
    status: body.status ?? row.status,
  });

  const updated = await prisma.crewMemberCourse.update({
    where: { id: row.id },
    data: {
      completedAt: nextCompletedAt,
      expiresAt: nextExpiresAt,
      status,
      // Si cambió el vencimiento, resetea hitos de mail (S9).
      ...(body.expiresAt !== undefined
        ? {
            lastExpiringEmailAt: null,
            lastExpiredEmailAt: null,
            expiringMilestonesSent: [],
          }
        : {}),
    },
    include: { course: true },
  });

  return toAssignmentResponse(updated, crew.competencyCertificateId);
}

/** Soft delete de una asignación. */
export async function deleteCrewMemberCourse(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberCourseResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberCourse.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: { course: true },
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_course_not_found",
      "Asignación de curso no encontrada",
    );
  }

  const updated = await prisma.crewMemberCourse.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
    include: { course: true },
  });
  return toAssignmentResponse(updated, crew.competencyCertificateId);
}

/**
 * Crea asignaciones pending (source=certificate) para los cursos del título.
 * No toca filas manuales ni las que ya existen activas.
 */
export async function assignCertificateCoursesToCrewMember(
  crewMemberId: string,
  competencyCertificateId: string | null | undefined,
): Promise<{ created: number; skipped: number }> {
  if (!crewMemberId || !competencyCertificateId) {
    return { created: 0, skipped: 0 };
  }

  const mappings = await prisma.competencyCertificateCourse.findMany({
    where: {
      competencyCertificateId,
      deletedAt: null,
    },
    select: { courseId: true },
  });
  if (mappings.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const mapping of mappings) {
    const existing = await prisma.crewMemberCourse.findFirst({
      where: {
        crewMemberId,
        courseId: mapping.courseId,
        deletedAt: null,
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const softDeleted = await prisma.crewMemberCourse.findFirst({
      where: {
        crewMemberId,
        courseId: mapping.courseId,
        deletedAt: { not: null },
      },
    });

    if (softDeleted) {
      await prisma.crewMemberCourse.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          source: "certificate",
          status: "pending",
          completedAt: null,
          expiresAt: null,
          lastExpiringEmailAt: null,
          lastExpiredEmailAt: null,
          expiringMilestonesSent: [],
        },
      });
    } else {
      await prisma.crewMemberCourse.create({
        data: {
          crewMemberId,
          courseId: mapping.courseId,
          source: "certificate",
          status: "pending",
        },
      });
    }
    created += 1;
  }

  return { created, skipped };
}

/**
 * Al cambiar el título del tripulante: quita asignaciones gestionadas por
 * el título anterior que ya no aplican, y crea las del título nuevo.
 */
export async function reconcileCrewMemberCertificateCourses(
  crewMemberId: string,
  competencyCertificateId: string | null | undefined,
): Promise<{ removed: number; created: number; skipped: number }> {
  const requiredIds = new Set<string>();
  if (competencyCertificateId) {
    const mappings = await prisma.competencyCertificateCourse.findMany({
      where: {
        competencyCertificateId,
        deletedAt: null,
      },
      select: { courseId: true },
    });
    for (const m of mappings) requiredIds.add(m.courseId);
  }

  const assignments = await prisma.crewMemberCourse.findMany({
    where: { crewMemberId, deletedAt: null },
  });

  let removed = 0;
  const now = new Date();
  for (const row of assignments) {
    if (requiredIds.has(row.courseId)) continue;
    if (!isCertificateManagedAssignment(row)) continue;
    await prisma.crewMemberCourse.update({
      where: { id: row.id },
      data: { deletedAt: now },
    });
    removed += 1;
  }

  const assignResult = competencyCertificateId
    ? await assignCertificateCoursesToCrewMember(
        crewMemberId,
        competencyCertificateId,
      )
    : { created: 0, skipped: 0 };

  return { removed, ...assignResult };
}

/**
 * Sync masivo: para cada tripulante activo con este título, crea faltantes.
 * Usado al reemplazar cursos del catálogo del título (paso 2).
 */
export async function syncCertificateCoursesToExistingCrewMembers(
  competencyCertificateId: string,
): Promise<{
  crewMembersTotal: number;
  crewMembersUpdated: number;
  assignmentsCreated: number;
  assignmentsSkipped: number;
}> {
  const crewMembers = await prisma.crewMember.findMany({
    where: {
      competencyCertificateId,
      deletedAt: null,
      state: true,
    },
    select: { id: true },
  });

  let assignmentsCreated = 0;
  let assignmentsSkipped = 0;
  let crewMembersUpdated = 0;

  for (const crew of crewMembers) {
    const result = await assignCertificateCoursesToCrewMember(
      crew.id,
      competencyCertificateId,
    );
    assignmentsCreated += result.created;
    assignmentsSkipped += result.skipped;
    if (result.created > 0) crewMembersUpdated += 1;
  }

  return {
    crewMembersTotal: crewMembers.length,
    crewMembersUpdated,
    assignmentsCreated,
    assignmentsSkipped,
  };
}
