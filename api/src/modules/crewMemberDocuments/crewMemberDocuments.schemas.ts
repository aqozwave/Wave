import { z } from "../../lib/zod.js";

/** Tipo embebido en respuestas de documento. */
export const documentTypeSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  subtype: z.string(),
});

/** Metadatos del documento (sin filePath). */
export const crewMemberDocumentResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    crewMemberId: z.uuid(),
    documentTypeId: z.uuid(),
    documentType: documentTypeSummarySchema,
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    sourceModule: z.string(),
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

export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCrewMemberDocumentsRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/**
 * Body JSON con archivo en base64.
 * documentTypeId apunta al maestro por empresa.
 */
export const createCrewMemberDocumentBodySchema = z.object({
  documentTypeId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
  /** Origen del alta; default crew (ficha / modal futuro). */
  sourceModule: z
    .enum(["crew", "prevention", "assets", "system"])
    .optional()
    .default("crew"),
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

/**
 * Descarga o vista previa.
 * inline=1|true → Content-Disposition: inline (abrir en el navegador).
 */
export const downloadCrewMemberDocumentRequestSchema = z.object({
  params: crewDocumentIdParamsSchema,
  query: z.object({
    inline: z
      .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
      .optional(),
  }),
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
