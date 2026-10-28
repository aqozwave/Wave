import { z } from "../../lib/zod.js";

/** Tipos de documento de tripulante (S7: amonestaciones). */
export const CREW_DOCUMENT_TYPES = ["warning_letter"] as const;

/** Metadatos del documento (sin filePath al cliente en listado OK; path interno). */
export const crewMemberDocumentResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    crewMemberId: z.uuid(),
    type: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    uploadedById: z.uuid().nullable(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberDocument");

export const listCrewMemberDocumentsResponseSchema = z
  .object({
    items: z.array(crewMemberDocumentResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListCrewMemberDocumentsResponse");

/** Params tripulante. */
export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCrewMemberDocumentsRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/**
 * Body JSON con archivo en base64 (sin multer).
 * contentBase64: raw o data-URL (data:…;base64,…).
 */
export const createCrewMemberDocumentBodySchema = z.object({
  type: z.enum(CREW_DOCUMENT_TYPES).default("warning_letter"),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
});

export const createCrewMemberDocumentRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberDocumentBodySchema,
});

export const createCrewMemberDocumentResponseSchema =
  crewMemberDocumentResponseSchema;

export const crewDocumentIdParamsSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
});

export const downloadCrewMemberDocumentRequestSchema = z.object({
  params: crewDocumentIdParamsSchema,
});

export const deleteCrewMemberDocumentRequestSchema = z.object({
  params: crewDocumentIdParamsSchema,
});

export const deleteCrewMemberDocumentResponseSchema =
  crewMemberDocumentResponseSchema;

export type CreateCrewMemberDocumentBody = z.infer<
  typeof createCrewMemberDocumentBodySchema
>;
export type CrewMemberDocumentResponse = z.infer<
  typeof crewMemberDocumentResponseSchema
>;
