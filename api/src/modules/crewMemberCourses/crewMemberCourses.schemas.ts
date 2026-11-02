import { z } from "../../lib/zod.js";

/** Estados persistidos / recalculados de una asignación. */
export const crewCourseStatusSchema = z.enum([
  "pending",
  "valid",
  "expiring_soon",
  "expired",
]);

/** Origen de la fila (auto por título vs alta a mano). */
export const crewCourseSourceSchema = z.enum([
  "rank",
  "certificate",
  "manual",
]);

/** Curso embebido en la respuesta de asignación. */
export const crewCourseEmbedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  whereTaught: z.string(),
  description: z.string().nullable(),
  isMandatory: z.boolean(),
  state: z.boolean(),
});

/**
 * Asignación de curso a un tripulante (ficha).
 * status se recalcula al leer; isMandatory viene del título o del catálogo.
 */
export const crewMemberCourseResponseSchema = z
  .object({
    id: z.uuid(),
    crewMemberId: z.uuid(),
    courseId: z.uuid(),
    course: crewCourseEmbedSchema.nullable(),
    completedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    status: crewCourseStatusSchema,
    source: crewCourseSourceSchema,
    /** Obligatorio según título (certificate) o catálogo (catalog). */
    isMandatory: z.boolean(),
    mandatorySource: z.enum(["certificate", "catalog"]),
    /** Días hasta vencer; null si no hay expiresAt. */
    daysUntilExpiry: z.number().int().nullable(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberCourse");

export const listCrewMemberCoursesResponseSchema = z
  .object({
    items: z.array(crewMemberCourseResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListCrewMemberCoursesResponse");

export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCrewMemberCoursesRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/**
 * Body POST: alta manual (source=manual).
 * Fechas opcionales; status se calcula en el service.
 */
export const createCrewMemberCourseBodySchema = z.object({
  courseId: z.uuid(),
  completedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const createCrewMemberCourseRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberCourseBodySchema,
});

export const createCrewMemberCourseResponseSchema =
  crewMemberCourseResponseSchema;

/** Params :id tripulante + :assignmentId fila CrewMemberCourse. */
export const crewMemberCourseAssignmentParamsSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
});

export const getCrewMemberCourseRequestSchema = z.object({
  params: crewMemberCourseAssignmentParamsSchema,
});

export const getCrewMemberCourseResponseSchema = crewMemberCourseResponseSchema;

/**
 * Body PATCH: fechas y/o status forzado (se recalcula si hay expiresAt).
 */
export const updateCrewMemberCourseBodySchema = z
  .object({
    completedAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    status: crewCourseStatusSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateCrewMemberCourseRequestSchema = z.object({
  params: crewMemberCourseAssignmentParamsSchema,
  body: updateCrewMemberCourseBodySchema,
});

export const updateCrewMemberCourseResponseSchema =
  crewMemberCourseResponseSchema;

export const deleteCrewMemberCourseRequestSchema = z.object({
  params: crewMemberCourseAssignmentParamsSchema,
});

export const deleteCrewMemberCourseResponseSchema =
  crewMemberCourseResponseSchema;

export type CreateCrewMemberCourseBody = z.infer<
  typeof createCrewMemberCourseBodySchema
>;
export type UpdateCrewMemberCourseBody = z.infer<
  typeof updateCrewMemberCourseBodySchema
>;
export type CrewMemberCourseResponse = z.infer<
  typeof crewMemberCourseResponseSchema
>;

/**
 * Filtro de la pantalla Vencimientos (portal viejo LibretasEmbarquePage tab cursos).
 * attention = expired + expiring_soon.
 */
export const expiryStatusFilterSchema = z.enum([
  "expired",
  "expiring_soon",
  "attention",
]);

/** Query GET /crew-member-courses (listado global de vencimientos). */
export const listExpiringCrewMemberCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: expiryStatusFilterSchema.default("attention"),
  search: z.string().max(200).optional(),
  businessId: z.uuid().optional(),
});

export const listExpiringCrewMemberCoursesRequestSchema = z.object({
  query: listExpiringCrewMemberCoursesQuerySchema,
});

/** Fila de vencimiento con datos del tripulante para la tabla. */
export const expiringCrewMemberCourseItemSchema = z
  .object({
    id: z.uuid(),
    crewMemberId: z.uuid(),
    courseId: z.uuid(),
    courseName: z.string(),
    status: crewCourseStatusSchema,
    daysUntilExpiry: z.number().int().nullable(),
    expiresAt: z.string().datetime().nullable(),
    isMandatory: z.boolean(),
    crew: z.object({
      id: z.uuid(),
      firstName: z.string(),
      lastName: z.string(),
      run: z.string(),
      email: z.string(),
      businessId: z.uuid(),
    }),
  })
  .openapi("ExpiringCrewMemberCourseItem");

export const listExpiringCrewMemberCoursesResponseSchema = z
  .object({
    items: z.array(expiringCrewMemberCourseItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    warningDays: z.number().int(),
  })
  .openapi("ListExpiringCrewMemberCoursesResponse");

export type ListExpiringCrewMemberCoursesQuery = z.infer<
  typeof listExpiringCrewMemberCoursesQuerySchema
>;
export type ExpiringCrewMemberCourseItem = z.infer<
  typeof expiringCrewMemberCourseItemSchema
>;
