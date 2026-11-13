import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { resolveNextBusinessId, resolveRequiredBusinessId } from "../../lib/tenant.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { syncCertificateCoursesToExistingCrewMembers } from "../crewMemberCourses/crewMemberCourses.service.js";
import type {
  CompetencyCertificateCourseItem,
  CompetencyCertificateResponse,
  CreateCompetencyCertificateBody,
  ListCompetencyCertificatesQuery,
  ReplaceCompetencyCertificateCoursesBody,
  UpdateCompetencyCertificateBody,
} from "./competencyCertificates.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toCertificateResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  officerKind: "captain" | "first_pilot" | null;
  requiresMuelleTravesia: boolean;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CompetencyCertificateResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    businessId: row.businessId,
    officerKind: row.officerKind,
    requiresMuelleTravesia: row.requiresMuelleTravesia,
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
  query: ListCompetencyCertificatesQuery,
): Prisma.CompetencyCertificateWhereInput {
  const base: Prisma.CompetencyCertificateWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return {
      ...base,
      ...(query.businessId ? { businessId: query.businessId } : {}),
      ...(query.officerKind ? { officerKind: query.officerKind } : {}),
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
    ...(query.officerKind ? { officerKind: query.officerKind } : {}),
  };
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: { businessId?: string | null },
): string {
  return resolveRequiredBusinessId(actor, body.businessId, "un certificado");
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertCertificateTenantAccess(
  actor: Actor,
  certificateBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== certificateBusinessId) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
}

/** Lista certificados visibles para el actor (paginado). */
export async function listCompetencyCertificates(
  actor: Actor,
  query: ListCompetencyCertificatesQuery,
): Promise<{
  items: CompetencyCertificateResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.competencyCertificate.count({ where }),
    prisma.competencyCertificate.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toCertificateResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getCompetencyCertificateById(
  actor: Actor,
  id: string,
): Promise<CompetencyCertificateResponse> {
  const row = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, row.businessId);
  return toCertificateResponse(row);
}

/**
 * Crea certificado (admin o superadmin).
 * Nombre único por empresa entre no borrados.
 */
export async function createCompetencyCertificate(
  actor: Actor,
  body: CreateCompetencyCertificateBody,
): Promise<CompetencyCertificateResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.competencyCertificate.create({
      data: {
        name: body.name,
        businessId,
        officerKind: body.officerKind ?? null,
        requiresMuelleTravesia: body.requiresMuelleTravesia ?? false,
        state: body.state ?? true,
      },
    });
    return toCertificateResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_competency_certificate_name",
        "El nombre del certificado ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza certificado. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateCompetencyCertificate(
  actor: Actor,
  id: string,
  payload: UpdateCompetencyCertificateBody,
): Promise<CompetencyCertificateResponse> {
  const existing = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    nextBusinessId = resolveNextBusinessId(
      actor,
      payload.businessId,
      existing.businessId,
    );
    if (nextBusinessId !== existing.businessId) {
      const business = await prisma.business.findFirst({
        where: { id: nextBusinessId, deletedAt: null },
      });
      if (!business) {
        throw new AppError(400, "business_not_found", "Empresa no encontrada");
      }
    }
  }

  const data: Prisma.CompetencyCertificateUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.state !== undefined) data.state = payload.state;
  if (payload.officerKind !== undefined) data.officerKind = payload.officerKind;
  if (payload.requiresMuelleTravesia !== undefined) {
    data.requiresMuelleTravesia = payload.requiresMuelleTravesia;
  }
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.competencyCertificate.update({
      where: { id },
      data,
    });
    return toCertificateResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_competency_certificate_name",
        "El nombre del certificado ya existe en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMember (S7), rechazar si hay tripulantes activos con ese id.
 */
export async function deleteCompetencyCertificateById(
  actor: Actor,
  id: string,
): Promise<CompetencyCertificateResponse> {
  const cert = await prisma.competencyCertificate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!cert) {
    throw new AppError(
      404,
      "competency_certificate_not_found",
      "Certificado no encontrado",
    );
  }
  assertCertificateTenantAccess(actor, cert.businessId);

  const updated = await prisma.competencyCertificate.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toCertificateResponse(updated);
}

/** Curso embebido en el ítem del join (null si el curso fue soft-deleted). */
type CourseEmbedRow = {
  id: string;
  name: string;
  whereTaught: string;
  description: string | null;
  isMandatory: boolean;
  state: boolean;
  deletedAt: Date | null;
};

/** Serializa fila del join + curso embebido al contrato Zod. */
function toCertificateCourseItem(row: {
  id: string;
  competencyCertificateId: string;
  courseId: string;
  isMandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
  course: CourseEmbedRow | null;
}): CompetencyCertificateCourseItem {
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

  return {
    id: row.id,
    competencyCertificateId: row.competencyCertificateId,
    courseId: row.courseId,
    isMandatory: row.isMandatory,
    course,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Normaliza body de replace: assignments gana; si no, courseIds → mandatory true.
 * Dedup por courseId (queda la primera aparición).
 */
function normalizeReplaceAssignments(
  body: ReplaceCompetencyCertificateCoursesBody,
): Array<{ courseId: string; isMandatory: boolean }> {
  if (Array.isArray(body.assignments)) {
    const seen = new Set<string>();
    const out: Array<{ courseId: string; isMandatory: boolean }> = [];
    for (const item of body.assignments) {
      if (seen.has(item.courseId)) continue;
      seen.add(item.courseId);
      out.push({
        courseId: item.courseId,
        isMandatory: item.isMandatory !== false,
      });
    }
    return out;
  }

  const seen = new Set<string>();
  const out: Array<{ courseId: string; isMandatory: boolean }> = [];
  for (const courseId of body.courseIds ?? []) {
    if (seen.has(courseId)) continue;
    seen.add(courseId);
    out.push({ courseId, isMandatory: true });
  }
  return out;
}

/** Forma corta assignments para la respuesta. */
function toAssignmentsShort(items: CompetencyCertificateCourseItem[]) {
  return items.map((item) => ({
    courseId: item.courseId,
    isMandatory: item.isMandatory,
  }));
}

/**
 * Lista cursos vinculados a un título marítimo (tenant-aware).
 * Orden: createdAt asc (estable para el editor).
 */
export async function listCompetencyCertificateCourses(
  actor: Actor,
  certificateId: string,
): Promise<{
  items: CompetencyCertificateCourseItem[];
  assignments: Array<{ courseId: string; isMandatory: boolean }>;
}> {
  // Reusa getById: 404 + tenant check del título.
  await getCompetencyCertificateById(actor, certificateId);

  const rows = await prisma.competencyCertificateCourse.findMany({
    where: { competencyCertificateId: certificateId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { course: true },
  });

  const items = rows.map(toCertificateCourseItem);
  return { items, assignments: toAssignmentsShort(items) };
}

/**
 * Reemplaza el set de cursos del título (soft-delete los que salen,
 * revive/crea los que entran). Valida que cada curso exista y sea
 * de la misma empresa. Luego sync a tripulantes con ese título (auto A).
 */
export async function replaceCompetencyCertificateCourses(
  actor: Actor,
  certificateId: string,
  body: ReplaceCompetencyCertificateCoursesBody,
): Promise<{
  items: CompetencyCertificateCourseItem[];
  assignments: Array<{ courseId: string; isMandatory: boolean }>;
  sync: {
    crewMembersTotal: number;
    crewMembersUpdated: number;
    assignmentsCreated: number;
    assignmentsSkipped: number;
  };
}> {
  const certificate = await getCompetencyCertificateById(actor, certificateId);
  const desired = normalizeReplaceAssignments(body);
  const desiredIds = desired.map((d) => d.courseId);
  const desiredMap = new Map(
    desired.map((d) => [d.courseId, d.isMandatory] as const),
  );

  if (desiredIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: { id: { in: desiredIds }, deletedAt: null },
      select: { id: true, businessId: true, state: true },
    });
    if (courses.length !== desiredIds.length) {
      throw new AppError(
        400,
        "course_not_found",
        "Uno o más cursos no existen o están eliminados",
      );
    }
    const foreign = courses.find((c) => c.businessId !== certificate.businessId);
    if (foreign) {
      throw new AppError(
        400,
        "course_business_mismatch",
        "Uno o más cursos no pertenecen a la misma empresa del título marítimo",
      );
    }
  }

  const now = new Date();
  // Incluye soft-deleted para poder revivir sin chocar el índice parcial.
  const existingRows = await prisma.competencyCertificateCourse.findMany({
    where: { competencyCertificateId: certificateId },
  });

  await prisma.$transaction(async (tx) => {
    for (const row of existingRows) {
      if (!desiredMap.has(row.courseId) && row.deletedAt === null) {
        await tx.competencyCertificateCourse.update({
          where: { id: row.id },
          data: { deletedAt: now },
        });
      }
    }

    for (const courseId of desiredIds) {
      const isMandatory = desiredMap.get(courseId) !== false;
      const existing = existingRows.find((r) => r.courseId === courseId);
      if (existing) {
        await tx.competencyCertificateCourse.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            isMandatory,
          },
        });
        continue;
      }
      await tx.competencyCertificateCourse.create({
        data: {
          competencyCertificateId: certificateId,
          courseId,
          isMandatory,
        },
      });
    }
  });

  const listed = await listCompetencyCertificateCourses(actor, certificateId);
  const sync = await syncCertificateCoursesToExistingCrewMembers(certificateId);
  return { ...listed, sync };
}
