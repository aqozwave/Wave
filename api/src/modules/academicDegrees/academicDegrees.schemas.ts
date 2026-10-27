import { z } from "../../lib/zod.js";

/**
 * Campos de título académico / marítimo.
 * name en minúsculas; businessId opcional en body (admin usa el suyo;
 * superadmin lo exige al crear).
 */
export const academicDegreeFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Empresa dueña del título. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Un título en respuestas de API. */
export const academicDegreeResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    businessId: z.uuid(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("AcademicDegree");

/** Body POST /academic-degrees. */
export const createAcademicDegreeBodySchema = academicDegreeFieldsSchema;

export const createAcademicDegreeRequestSchema = z.object({
  body: createAcademicDegreeBodySchema,
});

/** Query listado: paginación + filtro opcional de empresa (superadmin). */
export const listAcademicDegreesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listAcademicDegreesRequestSchema = z.object({
  query: listAcademicDegreesQuerySchema,
});

export const listAcademicDegreesResponseSchema = z
  .object({
    items: z.array(academicDegreeResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListAcademicDegreesResponse");

export const createAcademicDegreeResponseSchema = academicDegreeResponseSchema;
export const getAcademicDegreeResponseSchema = academicDegreeResponseSchema;
export const updateAcademicDegreeResponseSchema = academicDegreeResponseSchema;
export const deleteAcademicDegreeResponseSchema = academicDegreeResponseSchema;

/** Params `:id` uuid. */
export const academicDegreeIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getAcademicDegreeRequestSchema = z.object({
  params: academicDegreeIdParamsSchema,
});

export const deleteAcademicDegreeRequestSchema = z.object({
  params: academicDegreeIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateAcademicDegreeBodySchema = academicDegreeFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateAcademicDegreeRequestSchema = z.object({
  params: academicDegreeIdParamsSchema,
  body: updateAcademicDegreeBodySchema,
});

export type CreateAcademicDegreeBody = z.infer<
  typeof createAcademicDegreeBodySchema
>;
export type ListAcademicDegreesQuery = z.infer<
  typeof listAcademicDegreesQuerySchema
>;
export type AcademicDegreeResponse = z.infer<
  typeof academicDegreeResponseSchema
>;
export type UpdateAcademicDegreeBody = z.infer<
  typeof updateAcademicDegreeBodySchema
>;
