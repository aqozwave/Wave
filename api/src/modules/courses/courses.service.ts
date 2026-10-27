import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CourseResponse,
  CreateCourseBody,
  ListCoursesQuery,
  UpdateCourseBody,
} from "./courses.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toCourseResponse(row: {
  id: string;
  legacyMongoId: string | null;
  name: string;
  whereTaught: string;
  businessId: string;
  description: string | null;
  isMandatory: boolean;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CourseResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    name: row.name,
    whereTaught: row.whereTaught,
    businessId: row.businessId,
    description: row.description,
    isMandatory: row.isMandatory,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado: superadmin ve todas (o filtra por businessId);
 * admin/user solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListCoursesQuery,
): Prisma.CourseWhereInput {
  const base: Prisma.CourseWhereInput = { deletedAt: null };

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
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateCourseBody,
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
      "businessId es requerido para crear un curso",
    );
  }
  return body.businessId;
}

/**
 * 404 genérico si el actor no puede ver esa empresa
 * (no filtrar existencia a otra empresa).
 */
function assertCourseTenantAccess(
  actor: Actor,
  courseBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== courseBusinessId) {
    throw new AppError(404, "course_not_found", "Curso no encontrado");
  }
}

/** Lista cursos visibles para el actor (paginado). */
export async function listCourses(
  actor: Actor,
  query: ListCoursesQuery,
): Promise<{
  items: CourseResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ name: "asc" }, { whereTaught: "asc" }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toCourseResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id (tenant-aware). */
export async function getCourseById(
  actor: Actor,
  id: string,
): Promise<CourseResponse> {
  const row = await prisma.course.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(404, "course_not_found", "Curso no encontrado");
  }
  assertCourseTenantAccess(actor, row.businessId);
  return toCourseResponse(row);
}

/**
 * Crea curso (admin o superadmin).
 * Único por empresa + nombre + lugar de dictado.
 */
export async function createCourse(
  actor: Actor,
  body: CreateCourseBody,
): Promise<CourseResponse> {
  const businessId = resolveCreateBusinessId(actor, body);

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.course.create({
      data: {
        name: body.name,
        whereTaught: body.whereTaught,
        businessId,
        description: body.description ?? null,
        isMandatory: body.isMandatory ?? true,
        state: body.state ?? true,
      },
    });
    return toCourseResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_course",
        "Ya existe un curso con ese nombre y lugar de dictado en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Actualiza curso. Admin no puede cambiar businessId a otra empresa.
 */
export async function updateCourse(
  actor: Actor,
  id: string,
  payload: UpdateCourseBody,
): Promise<CourseResponse> {
  const existing = await prisma.course.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "course_not_found", "Curso no encontrado");
  }
  assertCourseTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin") {
      if (payload.businessId !== actor.businessId) {
        throw new AppError(
          403,
          "forbidden",
          "No puedes asignar el curso a otra empresa",
        );
      }
    }
    const business = await prisma.business.findFirst({
      where: { id: payload.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "business_not_found", "Empresa no encontrada");
    }
    nextBusinessId = payload.businessId;
  }

  const data: Prisma.CourseUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.whereTaught !== undefined) data.whereTaught = payload.whereTaught;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.isMandatory !== undefined) data.isMandatory = payload.isMandatory;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.course.update({
      where: { id },
      data,
    });
    return toCourseResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_course",
        "Ya existe un curso con ese nombre y lugar de dictado en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete.
 * Cuando exista CrewMemberCourse (S8), rechazar si hay asignaciones activas.
 */
export async function deleteCourseById(
  actor: Actor,
  id: string,
): Promise<CourseResponse> {
  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
  });
  if (!course) {
    throw new AppError(404, "course_not_found", "Curso no encontrado");
  }
  assertCourseTenantAccess(actor, course.businessId);

  const updated = await prisma.course.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });
  return toCourseResponse(updated);
}
