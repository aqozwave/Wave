import { z } from "../../lib/zod.js";

/**
 * Campos de área.
 * name en minúsculas; locationId obligatorio al crear.
 * businessId opcional en body: si viene, debe coincidir con location.businessId.
 */
export const areaFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Lugar de trabajo al que pertenece el área. */
  locationId: z.uuid(),
  /**
   * Opcional. Si se envía, debe ser la empresa de esa location.
   * Si se omite, el service la toma de location.businessId.
   */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Un área en respuestas de API. */
export const areaResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    locationId: z.uuid(),
    businessId: z.uuid(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Area");

/** Body POST /areas. */
export const createAreaBodySchema = areaFieldsSchema;

export const createAreaRequestSchema = z.object({
  body: createAreaBodySchema,
});

/** Query listado: paginación + filtros opcionales. */
export const listAreasQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});

export const listAreasRequestSchema = z.object({
  query: listAreasQuerySchema,
});

export const listAreasResponseSchema = z
  .object({
    items: z.array(areaResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListAreasResponse");

export const createAreaResponseSchema = areaResponseSchema;
export const getAreaResponseSchema = areaResponseSchema;
export const updateAreaResponseSchema = areaResponseSchema;
export const deleteAreaResponseSchema = areaResponseSchema;

/** Params `:id` uuid. */
export const areaIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getAreaRequestSchema = z.object({
  params: areaIdParamsSchema,
});

export const deleteAreaRequestSchema = z.object({
  params: areaIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Si cambia locationId, el service recalcula businessId y valida coherencia.
 */
export const updateAreaBodySchema = areaFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateAreaRequestSchema = z.object({
  params: areaIdParamsSchema,
  body: updateAreaBodySchema,
});

export type CreateAreaBody = z.infer<typeof createAreaBodySchema>;
export type ListAreasQuery = z.infer<typeof listAreasQuerySchema>;
export type AreaResponse = z.infer<typeof areaResponseSchema>;
export type UpdateAreaBody = z.infer<typeof updateAreaBodySchema>;
