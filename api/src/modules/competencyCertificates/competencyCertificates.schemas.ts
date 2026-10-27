import { z } from "../../lib/zod.js";

/** Oficial de nave: capitán / primer piloto; null = sin clasificar. */
export const officerKindSchema = z.enum(["captain", "first_pilot"]);

/**
 * Campos de certificado de competencia.
 * name en minúsculas; businessId opcional en body (admin usa el suyo;
 * superadmin lo exige al crear). officerKind opcional.
 */
export const competencyCertificateFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  /** Capitán / primer piloto; null limpia la clasificación. */
  officerKind: officerKindSchema.nullable().optional(),
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
