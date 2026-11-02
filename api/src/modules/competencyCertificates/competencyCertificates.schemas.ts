import { z } from "../../lib/zod.js";

/** Oficial de nave: capitán / primer piloto; null = sin clasificar. */
export const officerKindSchema = z.enum(["captain", "first_pilot"]);

/**
 * Campos de certificado de competencia.
 * name en minúsculas; businessId opcional en body (admin usa el suyo;
 * superadmin lo exige al crear). officerKind etiqueta; requiresMuelleTravesia regla.
 */
export const competencyCertificateFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  /** Capitán / primer piloto; null limpia la clasificación (solo etiqueta). */
  officerKind: officerKindSchema.nullable().optional(),
  /** Si true, el embarcado con este título debe tener muelles y travesías. */
  requiresMuelleTravesia: z.boolean().optional(),
  state: z.boolean().optional(),
});

/** Un certificado en respuestas de API. */
export const competencyCertificateResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    businessId: z.uuid(),
    officerKind: officerKindSchema.nullable(),
    requiresMuelleTravesia: z.boolean(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CompetencyCertificate");

/** Body POST /competency-certificates. */
export const createCompetencyCertificateBodySchema =
  competencyCertificateFieldsSchema;

export const createCompetencyCertificateRequestSchema = z.object({
  body: createCompetencyCertificateBodySchema,
});

/** Query listado: paginación + filtros opcionales. */
export const listCompetencyCertificatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  officerKind: officerKindSchema.optional(),
});

export const listCompetencyCertificatesRequestSchema = z.object({
  query: listCompetencyCertificatesQuerySchema,
});

export const listCompetencyCertificatesResponseSchema = z
  .object({
    items: z.array(competencyCertificateResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListCompetencyCertificatesResponse");

export const createCompetencyCertificateResponseSchema =
  competencyCertificateResponseSchema;
export const getCompetencyCertificateResponseSchema =
  competencyCertificateResponseSchema;
export const updateCompetencyCertificateResponseSchema =
  competencyCertificateResponseSchema;
export const deleteCompetencyCertificateResponseSchema =
  competencyCertificateResponseSchema;

/** Params `:id` uuid. */
export const competencyCertificateIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getCompetencyCertificateRequestSchema = z.object({
  params: competencyCertificateIdParamsSchema,
});

export const deleteCompetencyCertificateRequestSchema = z.object({
  params: competencyCertificateIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateCompetencyCertificateBodySchema =
  competencyCertificateFieldsSchema.partial().refine(
    (body) => Object.keys(body).length > 0,
    { message: "Debe enviar al menos un campo para actualizar" },
  );

export const updateCompetencyCertificateRequestSchema = z.object({
  params: competencyCertificateIdParamsSchema,
  body: updateCompetencyCertificateBodySchema,
});

export type CreateCompetencyCertificateBody = z.infer<
  typeof createCompetencyCertificateBodySchema
>;
export type ListCompetencyCertificatesQuery = z.infer<
  typeof listCompetencyCertificatesQuerySchema
>;
export type CompetencyCertificateResponse = z.infer<
  typeof competencyCertificateResponseSchema
>;
export type UpdateCompetencyCertificateBody = z.infer<
  typeof updateCompetencyCertificateBodySchema
>;

/**
 * Curso resumido embebido en el vínculo título↔curso
 * (para pintar nombre sin otro round-trip).
 */
export const certificateCourseEmbedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  whereTaught: z.string(),
  description: z.string().nullable(),
  isMandatory: z.boolean(),
  state: z.boolean(),
});

/** Una fila del join título marítimo ↔ curso. */
export const competencyCertificateCourseItemSchema = z
  .object({
    id: z.uuid(),
    competencyCertificateId: z.uuid(),
    courseId: z.uuid(),
    isMandatory: z.boolean(),
    course: certificateCourseEmbedSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CompetencyCertificateCourseItem");

/** GET /competency-certificates/:id/courses */
export const listCompetencyCertificateCoursesResponseSchema = z
  .object({
    items: z.array(competencyCertificateCourseItemSchema),
    /** Forma corta para el editor de títulos (portal viejo). */
    assignments: z.array(
      z.object({
        courseId: z.uuid(),
        isMandatory: z.boolean(),
      }),
    ),
  })
  .openapi("ListCompetencyCertificateCoursesResponse");

export const listCompetencyCertificateCoursesRequestSchema = z.object({
  params: competencyCertificateIdParamsSchema,
});

/**
 * Un ítem del body de replace: curso + si es obligatorio en ese título.
 */
export const replaceCertificateCourseAssignmentSchema = z.object({
  courseId: z.uuid(),
  isMandatory: z.boolean().default(true),
});

/**
 * Body PUT: reemplaza el set completo de cursos del título.
 * Acepta `assignments` (con flag) o `courseIds` (todos mandatory=true).
 */
export const replaceCompetencyCertificateCoursesBodySchema = z
  .object({
    assignments: z.array(replaceCertificateCourseAssignmentSchema).optional(),
    courseIds: z.array(z.uuid()).optional(),
  })
  .refine(
    (body) =>
      Array.isArray(body.assignments) || Array.isArray(body.courseIds),
    { message: "Debe enviar assignments o courseIds" },
  );

export const replaceCompetencyCertificateCoursesRequestSchema = z.object({
  params: competencyCertificateIdParamsSchema,
  body: replaceCompetencyCertificateCoursesBodySchema,
});

/**
 * Respuesta del replace: listado actualizado + resumen del sync
 * a tripulantes que ya tienen ese título (auto A).
 */
export const replaceCompetencyCertificateCoursesResponseSchema = z
  .object({
    items: z.array(competencyCertificateCourseItemSchema),
    assignments: z.array(
      z.object({
        courseId: z.uuid(),
        isMandatory: z.boolean(),
      }),
    ),
    sync: z.object({
      crewMembersTotal: z.number().int().nonnegative(),
      crewMembersUpdated: z.number().int().nonnegative(),
      assignmentsCreated: z.number().int().nonnegative(),
      assignmentsSkipped: z.number().int().nonnegative(),
    }),
  })
  .openapi("ReplaceCompetencyCertificateCoursesResponse");

export type ReplaceCompetencyCertificateCoursesBody = z.infer<
  typeof replaceCompetencyCertificateCoursesBodySchema
>;
export type CompetencyCertificateCourseItem = z.infer<
  typeof competencyCertificateCourseItemSchema
>;
