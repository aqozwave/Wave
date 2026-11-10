import { z } from "../../lib/zod.js";

/** Estados persistidos / recalculados de una asignación de capacitación. */
export const crewTrainingStatusSchema = z.enum([
  "pending",
  "valid",
  "expiring_soon",
  "expired",
]);

/** Capacitación embebida en la respuesta de asignación. */
export const crewTrainingEmbedSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  validityMonths: z.number().int().positive().nullable(),
  appliesTo: z.array(z.enum(["crew", "external_person"])),
  documentTypeId: z.uuid().nullable(),
  active: z.boolean(),
});

/** Evidencia documental embebida (si hay). */
export const crewTrainingEvidenceEmbedSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  expiresAt: z.string().datetime().nullable(),
  documentTypeId: z.uuid(),
});

/**
 * Asignación de capacitación Prevención a un tripulante (ficha).
 * status se recalcula al leer.
 */
export const crewMemberTrainingResponseSchema = z
  .object({
    id: z.uuid(),
    crewMemberId: z.uuid(),
    trainingId: z.uuid(),
    training: crewTrainingEmbedSchema.nullable(),
    completedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    status: crewTrainingStatusSchema,
    evidenceDocumentId: z.uuid().nullable(),
    evidenceDocument: crewTrainingEvidenceEmbedSchema.nullable(),
    /** Días hasta vencer; null si no hay expiresAt. */
    daysUntilExpiry: z.number().int().nullable(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberTraining");

export const listCrewMemberTrainingsResponseSchema = z
  .object({
    items: z.array(crewMemberTrainingResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListCrewMemberTrainingsResponse");

export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCrewMemberTrainingsRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/**
 * Body POST: alta de asignación.
 * Si hay completedAt y el catálogo tiene validityMonths, expiresAt se calcula.
 */
export const createCrewMemberTrainingBodySchema = z.object({
  trainingId: z.uuid(),
  completedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  evidenceDocumentId: z.uuid().nullable().optional(),
});

export const createCrewMemberTrainingRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberTrainingBodySchema,
});

export const createCrewMemberTrainingResponseSchema =
  crewMemberTrainingResponseSchema;

/** Params :id tripulante + :assignmentId fila CrewMemberTraining. */
export const crewMemberTrainingAssignmentParamsSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
});

export const getCrewMemberTrainingRequestSchema = z.object({
  params: crewMemberTrainingAssignmentParamsSchema,
});

export const getCrewMemberTrainingResponseSchema =
  crewMemberTrainingResponseSchema;

/** Body PATCH: fechas, status forzado y/o evidencia. */
export const updateCrewMemberTrainingBodySchema = z
  .object({
    completedAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    status: crewTrainingStatusSchema.optional(),
    evidenceDocumentId: z.uuid().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateCrewMemberTrainingRequestSchema = z.object({
  params: crewMemberTrainingAssignmentParamsSchema,
  body: updateCrewMemberTrainingBodySchema,
});

export const updateCrewMemberTrainingResponseSchema =
  crewMemberTrainingResponseSchema;

export const deleteCrewMemberTrainingRequestSchema = z.object({
  params: crewMemberTrainingAssignmentParamsSchema,
});

export const deleteCrewMemberTrainingResponseSchema =
  crewMemberTrainingResponseSchema;

/**
 * Body POST evidencia: archivo base64.
 * documentTypeId sale del catálogo Training; no se manda en el body.
 */
export const uploadCrewMemberTrainingEvidenceBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
  /** ISO; si falta y el tipo requiresExpiry, se usa expiresAt de la asignación. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export const uploadCrewMemberTrainingEvidenceRequestSchema = z.object({
  params: crewMemberTrainingAssignmentParamsSchema,
  body: uploadCrewMemberTrainingEvidenceBodySchema,
});

export const uploadCrewMemberTrainingEvidenceResponseSchema =
  crewMemberTrainingResponseSchema;

export type CreateCrewMemberTrainingBody = z.infer<
  typeof createCrewMemberTrainingBodySchema
>;
export type UpdateCrewMemberTrainingBody = z.infer<
  typeof updateCrewMemberTrainingBodySchema
>;
export type UploadCrewMemberTrainingEvidenceBody = z.infer<
  typeof uploadCrewMemberTrainingEvidenceBodySchema
>;
export type CrewMemberTrainingResponse = z.infer<
  typeof crewMemberTrainingResponseSchema
>;
