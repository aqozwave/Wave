import { z } from "../../lib/zod.js";

/**
 * Campos de muelle.
 * name en minúsculas; portName se conserva (casing importa en unicidad).
 * businessId opcional en body (admin usa el suyo; superadmin lo exige al crear).
 */
export const muelleFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Puerto del muelle (texto libre; UI sugiere valores conocidos). */
  portName: z
    .string({ error: "Puerto es requerido" })
    .trim()
    .min(1, "Puerto es requerido"),
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Un muelle en respuestas de API. */
export const muelleResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    portName: z.string(),
    businessId: z.uuid(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Muelle");

/** Body POST /muelles. */
export const createMuelleBodySchema = muelleFieldsSchema;

export const createMuelleRequestSchema = z.object({
  body: createMuelleBodySchema,
});

/** Query listado: paginación + filtros opcionales. */
export const listMuellesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  portName: z.string().trim().min(1).optional(),
});

export const listMuellesRequestSchema = z.object({
  query: listMuellesQuerySchema,
});

export const listMuellesResponseSchema = z
  .object({
    items: z.array(muelleResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListMuellesResponse");

export const createMuelleResponseSchema = muelleResponseSchema;
export const getMuelleResponseSchema = muelleResponseSchema;
export const updateMuelleResponseSchema = muelleResponseSchema;
export const deleteMuelleResponseSchema = muelleResponseSchema;

/** Params `:id` uuid. */
export const muelleIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getMuelleRequestSchema = z.object({
  params: muelleIdParamsSchema,
});

export const deleteMuelleRequestSchema = z.object({
  params: muelleIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateMuelleBodySchema = muelleFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateMuelleRequestSchema = z.object({
  params: muelleIdParamsSchema,
  body: updateMuelleBodySchema,
});

export type CreateMuelleBody = z.infer<typeof createMuelleBodySchema>;
export type ListMuellesQuery = z.infer<typeof listMuellesQuerySchema>;
export type MuelleResponse = z.infer<typeof muelleResponseSchema>;
export type UpdateMuelleBody = z.infer<typeof updateMuelleBodySchema>;
