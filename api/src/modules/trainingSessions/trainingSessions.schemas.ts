import { z } from "../../lib/zod.js";

/** Estado de la sesión en API. */
export const trainingSessionStatusSchema = z.enum([
  "draft",
  "completed",
  "cancelled",
]);

/** Capacitación embebida en la sesión. */
export const trainingSessionTrainingEmbedSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  validityMonths: z.number().int().positive().nullable(),
  documentTypeId: z.uuid().nullable(),
});

/** Nave/lugar embebido en la sesión. */
export const trainingSessionLocationEmbedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/** Asistente embebido. */
export const trainingSessionAttendeeSchema = z.object({
  id: z.uuid(),
  crewMemberId: z.uuid(),
  crewMemberName: z.string(),
  crewMemberRun: z.string(),
  crewMemberTrainingId: z.uuid().nullable(),
  evidenceDocumentId: z.uuid().nullable(),
  logEntryId: z.uuid().nullable(),
});

/** Sesión de capacitación (grupal o individual). */
export const trainingSessionResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    locationId: z.uuid(),
    location: trainingSessionLocationEmbedSchema.nullable(),
    trainingId: z.uuid(),
    training: trainingSessionTrainingEmbedSchema.nullable(),
    heldAt: z.string().datetime(),
    status: trainingSessionStatusSchema,
    notes: z.string().nullable(),
    hasCertificate: z.boolean(),
    fileOriginalName: z.string().nullable(),
    fileMimeType: z.string().nullable(),
    fileSize: z.number().int().nonnegative().nullable(),
    closedAt: z.string().datetime().nullable(),
    closedById: z.uuid().nullable(),
    createdById: z.uuid().nullable(),
    attendeeCount: z.number().int().nonnegative(),
    attendees: z.array(trainingSessionAttendeeSchema),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("TrainingSession");

/** Query listado. */
export const listTrainingSessionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  trainingId: z.uuid().optional(),
  status: trainingSessionStatusSchema.optional(),
});

export const listTrainingSessionsRequestSchema = z.object({
  query: listTrainingSessionsQuerySchema,
});

export const listTrainingSessionsResponseSchema = z
  .object({
    items: z.array(trainingSessionResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListTrainingSessionsResponse");

/** Body POST: crea borrador con 1..N asistentes. */
export const createTrainingSessionBodySchema = z.object({
  trainingId: z.uuid(),
  /** Nave donde se dicta (debe coincidir con los embarcados). */
  locationId: z.uuid(),
  heldAt: z.string().datetime(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Superadmin: empresa destino. Admin/prevencionista usa la suya. */
  businessId: z.uuid().optional(),
  /** Al menos una persona (individual o grupal). */
  crewMemberIds: z.array(z.uuid()).min(1).max(200),
});

export const createTrainingSessionRequestSchema = z.object({
  body: createTrainingSessionBodySchema,
});

export const createTrainingSessionResponseSchema = trainingSessionResponseSchema;

export const trainingSessionIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getTrainingSessionRequestSchema = z.object({
  params: trainingSessionIdParamsSchema,
});

export const getTrainingSessionResponseSchema = trainingSessionResponseSchema;

/** Body PATCH: solo borrador. */
export const updateTrainingSessionBodySchema = z
  .object({
    heldAt: z.string().datetime().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    /** Si viene, reemplaza la lista completa de asistentes. */
    crewMemberIds: z.array(z.uuid()).min(1).max(200).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateTrainingSessionRequestSchema = z.object({
  params: trainingSessionIdParamsSchema,
  body: updateTrainingSessionBodySchema,
});

export const updateTrainingSessionResponseSchema = trainingSessionResponseSchema;

/** Body POST certificado/acta (PDF u otro doc permitido). */
export const uploadTrainingSessionCertificateBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
});

export const uploadTrainingSessionCertificateRequestSchema = z.object({
  params: trainingSessionIdParamsSchema,
  body: uploadTrainingSessionCertificateBodySchema,
});

export const uploadTrainingSessionCertificateResponseSchema =
  trainingSessionResponseSchema;

export const completeTrainingSessionRequestSchema = z.object({
  params: trainingSessionIdParamsSchema,
});

export const completeTrainingSessionResponseSchema =
  trainingSessionResponseSchema;

export const cancelTrainingSessionRequestSchema = z.object({
  params: trainingSessionIdParamsSchema,
});

export const cancelTrainingSessionResponseSchema = trainingSessionResponseSchema;

export type CreateTrainingSessionBody = z.infer<
  typeof createTrainingSessionBodySchema
>;
export type UpdateTrainingSessionBody = z.infer<
  typeof updateTrainingSessionBodySchema
>;
export type UploadTrainingSessionCertificateBody = z.infer<
  typeof uploadTrainingSessionCertificateBodySchema
>;
export type ListTrainingSessionsQuery = z.infer<
  typeof listTrainingSessionsQuerySchema
>;
export type TrainingSessionResponse = z.infer<
  typeof trainingSessionResponseSchema
>;
