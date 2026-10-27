import { z } from "../../lib/zod.js";

/** Cuotas de pasadas permitidas (portal viejo). */
export const REQUIRED_PASSAGES_VALUES = [10, 4] as const;

/** requiredPassages: solo 10 o 4. */
const requiredPassagesSchema = z
  .number({ error: "Cuota de pasadas es requerida" })
  .refine(
    (value): value is (typeof REQUIRED_PASSAGES_VALUES)[number] =>
      (REQUIRED_PASSAGES_VALUES as readonly number[]).includes(value),
    { message: "La cuota de pasadas debe ser 10 o 4" },
  );

/**
 * Campos de travesía.
 * name en minúsculas; requiredPassages 10|4.
 * businessId opcional en body (admin usa el suyo; superadmin lo exige al crear).
 */
export const travesiaFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Cuota de pasadas (10 o 4). */
  requiredPassages: requiredPassagesSchema,
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Una travesía en respuestas de API. */
export const travesiaResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    requiredPassages: z.number().int(),
    businessId: z.uuid(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Travesia");

/** Body POST /travesias. */
export const createTravesiaBodySchema = travesiaFieldsSchema;

export const createTravesiaRequestSchema = z.object({
  body: createTravesiaBodySchema,
});

/** Query listado: paginación + filtro empresa opcional. */
export const listTravesiasQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listTravesiasRequestSchema = z.object({
  query: listTravesiasQuerySchema,
});

export const listTravesiasResponseSchema = z
  .object({
    items: z.array(travesiaResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListTravesiasResponse");

export const createTravesiaResponseSchema = travesiaResponseSchema;
export const getTravesiaResponseSchema = travesiaResponseSchema;
export const updateTravesiaResponseSchema = travesiaResponseSchema;
export const deleteTravesiaResponseSchema = travesiaResponseSchema;

/** Params `:id` uuid. */
export const travesiaIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getTravesiaRequestSchema = z.object({
  params: travesiaIdParamsSchema,
});

export const deleteTravesiaRequestSchema = z.object({
  params: travesiaIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateTravesiaBodySchema = travesiaFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateTravesiaRequestSchema = z.object({
  params: travesiaIdParamsSchema,
  body: updateTravesiaBodySchema,
});

export type CreateTravesiaBody = z.infer<typeof createTravesiaBodySchema>;
export type ListTravesiasQuery = z.infer<typeof listTravesiasQuerySchema>;
export type TravesiaResponse = z.infer<typeof travesiaResponseSchema>;
export type UpdateTravesiaBody = z.infer<typeof updateTravesiaBodySchema>;
