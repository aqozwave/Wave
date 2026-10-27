import { z } from "../../lib/zod.js";

/**
 * Campos de curso del catálogo.
 * name y whereTaught en minúsculas; businessId opcional en body
 * (admin usa el suyo; superadmin lo exige al crear).
 */
export const courseFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Lugar / institución donde se dicta. */
  whereTaught: z
    .string({ error: "Lugar de dictado es requerido" })
    .trim()
    .min(1, "Lugar de dictado es requerido")
    .transform((v) => v.toLowerCase()),
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v.length === 0 ? undefined : v)),
  isMandatory: z.boolean().optional(),
  state: z.boolean().optional(),
});

/** Un curso en respuestas de API. */
export const courseResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    whereTaught: z.string(),
    businessId: z.uuid(),
    description: z.string().nullable(),
    isMandatory: z.boolean(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Course");

/** Body POST /courses. */
export const createCourseBodySchema = courseFieldsSchema;

export const createCourseRequestSchema = z.object({
  body: createCourseBodySchema,
});

/** Query listado: paginación + filtro opcional de empresa (superadmin). */
export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listCoursesRequestSchema = z.object({
  query: listCoursesQuerySchema,
});

export const listCoursesResponseSchema = z
  .object({
    items: z.array(courseResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListCoursesResponse");

export const createCourseResponseSchema = courseResponseSchema;
export const getCourseResponseSchema = courseResponseSchema;
export const updateCourseResponseSchema = courseResponseSchema;
export const deleteCourseResponseSchema = courseResponseSchema;

/** Params `:id` uuid. */
export const courseIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getCourseRequestSchema = z.object({
  params: courseIdParamsSchema,
});

export const deleteCourseRequestSchema = z.object({
  params: courseIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * description puede ir a null para limpiar.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateCourseBodySchema = courseFieldsSchema
  .extend({
    description: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null || v.length === 0) return null;
        return v;
      }),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateCourseRequestSchema = z.object({
  params: courseIdParamsSchema,
  body: updateCourseBodySchema,
});

export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
export type CourseResponse = z.infer<typeof courseResponseSchema>;
export type UpdateCourseBody = z.infer<typeof updateCourseBodySchema>;
