import { z } from "../../lib/zod.js";

/**
 * Campos de rango / cargo.
 * name en minúsculas; businessId opcional en body (admin usa el suyo;
 * superadmin lo exige al crear).
 */
export const rankFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Empresa dueña del rango. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Un rango en respuestas de API. */
export const rankResponseSchema = z
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
  .openapi("Rank");

/** Body POST /ranks. */
export const createRankBodySchema = rankFieldsSchema;

export const createRankRequestSchema = z.object({
  body: createRankBodySchema,
});

/** Query listado: paginación + filtro opcional de empresa (superadmin). */
export const listRanksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listRanksRequestSchema = z.object({
  query: listRanksQuerySchema,
});

export const listRanksResponseSchema = z
  .object({
    items: z.array(rankResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListRanksResponse");

export const createRankResponseSchema = rankResponseSchema;
export const getRankResponseSchema = rankResponseSchema;
export const updateRankResponseSchema = rankResponseSchema;
export const deleteRankResponseSchema = rankResponseSchema;

/** Params `:id` uuid. */
export const rankIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getRankRequestSchema = z.object({
  params: rankIdParamsSchema,
});

export const deleteRankRequestSchema = z.object({
  params: rankIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateRankBodySchema = rankFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateRankRequestSchema = z.object({
  params: rankIdParamsSchema,
  body: updateRankBodySchema,
});

export type CreateRankBody = z.infer<typeof createRankBodySchema>;
export type ListRanksQuery = z.infer<typeof listRanksQuerySchema>;
export type RankResponse = z.infer<typeof rankResponseSchema>;
export type UpdateRankBody = z.infer<typeof updateRankBodySchema>;
