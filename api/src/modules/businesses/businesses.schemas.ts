import { z } from "../../lib/zod.js";

/** Texto opcional: "" → undefined. */
const optionalText = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return v.trim();
  });

/** Email opcional con validación de formato. */
const optionalEmail = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return v.trim().toLowerCase();
  })
  .pipe(z.string().email("Formato de correo inválido").optional());

/**
 * Campos de empresa (create / respuesta).
 * name se guarda en minúsculas (mismo criterio que el portal viejo).
 */
export const businessFieldsSchema = z.object({
  rut: optionalText,
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  giro: optionalText,
  country: optionalText,
  commune: optionalText,
  city: optionalText,
  phone: optionalText,
  email: optionalEmail,
  description: optionalText,
  state: z.boolean().optional(),
});

/** Una empresa en respuestas de API (sin filtrar campos internos). */
export const businessResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    rut: z.string().nullable(),
    name: z.string(),
    giro: z.string().nullable(),
    country: z.string().nullable(),
    commune: z.string().nullable(),
    city: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    description: z.string().nullable(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Business");

/** Body de POST /businesses. */
export const createBusinessBodySchema = businessFieldsSchema;

export const createBusinessRequestSchema = z.object({
  body: createBusinessBodySchema,
});

/** Query de listado paginado. */
export const listBusinessesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listBusinessesRequestSchema = z.object({
  query: listBusinessesQuerySchema,
});

/** Respuesta de listado. */
export const listBusinessesResponseSchema = z
  .object({
    items: z.array(businessResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListBusinessesResponse");

/** Respuesta de create. */
export const createBusinessResponseSchema = businessResponseSchema;

export type CreateBusinessBody = z.infer<typeof createBusinessBodySchema>;
export type ListBusinessesQuery = z.infer<typeof listBusinessesQuerySchema>;
export type BusinessResponse = z.infer<typeof businessResponseSchema>;
