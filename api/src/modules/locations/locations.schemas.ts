import { z } from "../../lib/zod.js";

/** Texto opcional: "" → undefined. */
const optionalText = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return v.trim();
  });

/** Email opcional con formato. */
const optionalEmail = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return v.trim().toLowerCase();
  })
  .pipe(z.string().email("Formato de correo inválido").optional());

/**
 * Tipo de lugar de trabajo (API en inglés).
 * UI: vessel=Nave, office=Oficina, warehouse=Bodega, other=Otro.
 * null = sin clasificar (ETL / pendiente).
 */
export const locationKindSchema = z.enum([
  "vessel",
  "office",
  "warehouse",
  "other",
]);

/**
 * Campos de lugar de trabajo.
 * name en minúsculas (mismo criterio que el portal viejo).
 */
export const locationFieldsSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .transform((v) => v.toLowerCase()),
  /** Obligatorio para superadmin; admin lo ignora (usa su empresa). */
  businessId: z.uuid().optional(),
  /** Opcional: null/omitido = sin clasificar. */
  kind: locationKindSchema.nullable().optional(),
  country: optionalText,
  commune: optionalText,
  city: optionalText,
  phone: optionalText,
  email: optionalEmail,
  description: optionalText,
  state: z.boolean().optional(),
});

/** Un lugar de trabajo en respuestas de API. */
export const locationResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    name: z.string(),
    kind: locationKindSchema.nullable(),
    businessId: z.uuid(),
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
  .openapi("Location");

/** Body POST /locations. */
export const createLocationBodySchema = locationFieldsSchema;

export const createLocationRequestSchema = z.object({
  body: createLocationBodySchema,
});

/** Query listado: paginación + filtro opcional de empresa (superadmin). */
export const listLocationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
});

export const listLocationsRequestSchema = z.object({
  query: listLocationsQuerySchema,
});

export const listLocationsResponseSchema = z
  .object({
    items: z.array(locationResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListLocationsResponse");

export const createLocationResponseSchema = locationResponseSchema;
export const getLocationResponseSchema = locationResponseSchema;
export const updateLocationResponseSchema = locationResponseSchema;
export const deleteLocationResponseSchema = locationResponseSchema;

/** Params `:id` uuid. */
export const locationIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getLocationRequestSchema = z.object({
  params: locationIdParamsSchema,
});

export const deleteLocationRequestSchema = z.object({
  params: locationIdParamsSchema,
});

/**
 * Body PATCH: campos parciales.
 * Admin no puede mover businessId a otra empresa (service).
 */
export const updateLocationBodySchema = locationFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateLocationRequestSchema = z.object({
  params: locationIdParamsSchema,
  body: updateLocationBodySchema,
});

export type CreateLocationBody = z.infer<typeof createLocationBodySchema>;
export type ListLocationsQuery = z.infer<typeof listLocationsQuerySchema>;
export type LocationResponse = z.infer<typeof locationResponseSchema>;
export type UpdateLocationBody = z.infer<typeof updateLocationBodySchema>;

/** Body POST /locations/me/position — lat/lng del navegador a bordo. */
export const reportVesselPositionBodySchema = z.object({
  /** Latitud WGS84 (−90…90). */
  latitude: z.number().min(-90).max(90),
  /** Longitud WGS84 (−180…180). */
  longitude: z.number().min(-180).max(180),
  /** Precisión en metros (GeolocationCoordinates.accuracy); opcional. */
  accuracyM: z.number().nonnegative().nullable().optional(),
});

export const reportVesselPositionRequestSchema = z.object({
  body: reportVesselPositionBodySchema,
});

/** Última posición conocida de una nave (o null si aún no hay lecturas). */
export const vesselPositionResponseSchema = z
  .object({
    locationId: z.uuid(),
    locationName: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    accuracyM: z.number().nullable(),
    source: z.string(),
    recordedAt: z.string().datetime(),
    reportedById: z.uuid().nullable(),
  })
  .nullable()
  .openapi("VesselPosition");

export const getMyVesselPositionRequestSchema = z.object({});

export const getLocationPositionRequestSchema = z.object({
  params: locationIdParamsSchema,
});

/**
 * Una fila del listado admin: nave + última señal (coords null = sin lecturas).
 * Sirve para el mapa de flota y la tabla “última señal”.
 */
export const vesselPositionListItemSchema = z
  .object({
    locationId: z.uuid(),
    locationName: z.string(),
    kind: locationKindSchema.nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    accuracyM: z.number().nullable(),
    source: z.string().nullable(),
    recordedAt: z.string().datetime().nullable(),
    reportedById: z.uuid().nullable(),
  })
  .openapi("VesselPositionListItem");

/** Query GET /locations/positions — filtro opcional de empresa (superadmin). */
export const listVesselPositionsQuerySchema = z.object({
  businessId: z.uuid().optional(),
});

export const listVesselPositionsRequestSchema = z.object({
  query: listVesselPositionsQuerySchema,
});

export const listVesselPositionsResponseSchema = z
  .object({
    items: z.array(vesselPositionListItemSchema),
  })
  .openapi("ListVesselPositionsResponse");

export const reportVesselPositionResponseSchema = vesselPositionResponseSchema;
export const getVesselPositionResponseSchema = vesselPositionResponseSchema;

export type ReportVesselPositionBody = z.infer<
  typeof reportVesselPositionBodySchema
>;
export type VesselPositionResponse = z.infer<
  typeof vesselPositionResponseSchema
>;
export type ListVesselPositionsQuery = z.infer<
  typeof listVesselPositionsQuerySchema
>;
export type VesselPositionListItem = z.infer<
  typeof vesselPositionListItemSchema
>;
