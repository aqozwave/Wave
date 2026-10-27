import { z } from "../../lib/zod.js";

/**
 * Campos de puerto.
 * name con trim; casing se conserva (ej. "Puerto Montt").
 * businessId opcional en body (admin usa el suyo; superadmin lo exige al crear).
 */
export const portFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido"),
  /** Empresa dueña. Obligatorio para superadmin al crear. */
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

/** Un puerto en respuestas de API. */
export const portResponseSchema = z
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
  .openapi("Port");

/** Body POST /ports. */
export const createPortBodySchema = portFieldsSchema;

export const createPortRequestSchema = z.object({
  body: createPortBodySchema,
});

/** Query listado: paginación + filtro empresa opcional. */
export const listPortsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listPortsRequestSchema = z.object({
  query: listPortsQuerySchema,
});

export const listPortsResponseSchema = z
  .object({
    items: z.array(portResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListPortsResponse");

export const createPortResponseSchema = portResponseSchema;
export const getPortResponseSchema = portResponseSchema;
export const updatePortResponseSchema = portResponseSchema;
export const deletePortResponseSchema = portResponseSchema;

/** Params `:id` uuid. */
export const portIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getPortRequestSchema = z.object({
  params: portIdParamsSchema,
});

export const deletePortRequestSchema = z.object({
  params: portIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updatePortBodySchema = portFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updatePortRequestSchema = z.object({
  params: portIdParamsSchema,
  body: updatePortBodySchema,
});

export type CreatePortBody = z.infer<typeof createPortBodySchema>;
export type ListPortsQuery = z.infer<typeof listPortsQuerySchema>;
export type PortResponse = z.infer<typeof portResponseSchema>;
export type UpdatePortBody = z.infer<typeof updatePortBodySchema>;
