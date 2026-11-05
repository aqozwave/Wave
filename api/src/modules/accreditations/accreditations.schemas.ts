import { z } from "../../lib/zod.js";

/** Estados de habilitación (API en snake lowercase). */
export const accreditationStatusSchema = z.enum([
  "invited",
  "pending",
  "in_review",
  "observed",
  "approved",
  "rejected",
]);

/** Org resumida en listados de habilitación. */
const organizationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  rut: z.string(),
  businessId: z.uuid(),
});

/** Habilitación en respuestas API. */
export const accreditationResponseSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    organizationId: z.uuid(),
    organization: organizationSummarySchema,
    status: accreditationStatusSchema,
    message: z.string().nullable(),
    reviewNote: z.string().nullable(),
    requestedAt: z.string().datetime().nullable(),
    requestedById: z.uuid().nullable(),
    dueAt: z.string().datetime().nullable(),
    submittedAt: z.string().datetime().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewedById: z.uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ContractorAccreditation");

/** Query GET /accreditations. */
export const listAccreditationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  status: accreditationStatusSchema.optional(),
  search: z.string().trim().optional(),
});

export const listAccreditationsRequestSchema = z.object({
  query: listAccreditationsQuerySchema,
});

export const listAccreditationsResponseSchema = z
  .object({
    items: z.array(accreditationResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListAccreditationsResponse");

export const accreditationIdParamsSchema = z.object({ id: z.uuid() });

export const getAccreditationRequestSchema = z.object({
  params: accreditationIdParamsSchema,
});

export const getAccreditationResponseSchema = accreditationResponseSchema;

/**
 * Solicitar documentación (crea HAB en pending).
 * message = texto al contratista; dueAt = plazo ISO opcional.
 */
export const createAccreditationBodySchema = z.object({
  organizationId: z.uuid(),
  dueAt: z.string().datetime().optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
});

export const createAccreditationRequestSchema = z.object({
  body: createAccreditationBodySchema,
});

export const createAccreditationResponseSchema = accreditationResponseSchema;

/** Body devolver / rechazar (nota obligatoria). */
export const accreditationReviewNoteBodySchema = z.object({
  reviewNote: z
    .string({ error: "La nota es requerida" })
    .trim()
    .min(1, "La nota es requerida")
    .max(2000),
});

export const submitAccreditationRequestSchema = z.object({
  params: accreditationIdParamsSchema,
});

export const approveAccreditationRequestSchema = z.object({
  params: accreditationIdParamsSchema,
});

export const returnAccreditationRequestSchema = z.object({
  params: accreditationIdParamsSchema,
  body: accreditationReviewNoteBodySchema,
});

export const rejectAccreditationRequestSchema = z.object({
  params: accreditationIdParamsSchema,
  body: accreditationReviewNoteBodySchema,
});

/** Query GET /accreditations/:id/history (P5h). */
export const listAccreditationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  /** Busca en evento / detalle / usuario. */
  search: z.string().trim().optional(),
  /** Filtra por éxito del audit (true|false). */
  success: z.enum(["true", "false"]).optional(),
});

export const listAccreditationHistoryRequestSchema = z.object({
  params: accreditationIdParamsSchema,
  query: listAccreditationHistoryQuerySchema,
});

/** Evento de historial de una HAB (derivado de activity_logs). */
export const accreditationHistoryItemSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.string().datetime(),
    /** Título legible del evento (ej. «Documento aprobado»). */
    event: z.string(),
    /** Rol del actor si se conoce. */
    role: z.string().nullable(),
    /** Nombre o email del actor. */
    user: z.string().nullable(),
    /** Detalle (código doc, nota, etc.). */
    detail: z.string().nullable(),
    /** Resultado corto para chip (Enviada, Aprobado, Observado…). */
    result: z.string(),
    /** Tone del chip: success | warning | danger | info | neutral. */
    resultTone: z.enum(["success", "warning", "danger", "info", "neutral"]),
    success: z.boolean(),
    action: z.string(),
    resource: z.string(),
  })
  .openapi("AccreditationHistoryItem");

export const listAccreditationHistoryResponseSchema = z
  .object({
    items: z.array(accreditationHistoryItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListAccreditationHistoryResponse");

export type AccreditationResponse = z.infer<typeof accreditationResponseSchema>;
export type ListAccreditationsQuery = z.infer<
  typeof listAccreditationsQuerySchema
>;
export type CreateAccreditationBody = z.infer<
  typeof createAccreditationBodySchema
>;
export type AccreditationReviewNoteBody = z.infer<
  typeof accreditationReviewNoteBodySchema
>;
export type ListAccreditationHistoryQuery = z.infer<
  typeof listAccreditationHistoryQuerySchema
>;
