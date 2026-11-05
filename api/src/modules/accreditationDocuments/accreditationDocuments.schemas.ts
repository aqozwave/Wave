import { z } from "../../lib/zod.js";

/** Estados de un doc de empresa en la HAB. */
export const contractorDocumentStatusSchema = z.enum([
  "pending_validation",
  "validated",
  "observed",
  "replaced",
]);

/** Tipo de documento resumido en checklist. */
const documentTypeSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  requiresExpiry: z.boolean(),
});

/** Documento cargado (sin filePath). */
export const contractorOrgDocumentResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    accreditationId: z.uuid(),
    documentTypeId: z.uuid(),
    documentType: documentTypeSummarySchema,
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
    status: contractorDocumentStatusSchema,
    observation: z.string().nullable(),
    expiresAt: z.string().datetime().nullable(),
    uploadedById: z.uuid().nullable(),
    validatedById: z.uuid().nullable(),
    validatedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ContractorOrgDocument");

/**
 * Fila del checklist P5: tipo del pack company + documento vigente (si hay).
 * document=null → aún no cargado.
 */
export const accreditationDocumentChecklistItemSchema = z
  .object({
    documentType: documentTypeSummarySchema,
    document: contractorOrgDocumentResponseSchema.nullable(),
  })
  .openapi("AccreditationDocumentChecklistItem");

export const listAccreditationDocumentsResponseSchema = z
  .object({
    items: z.array(accreditationDocumentChecklistItemSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListAccreditationDocumentsResponse");

export const accreditationIdParamsSchema = z.object({ id: z.uuid() });

export const listAccreditationDocumentsRequestSchema = z.object({
  params: accreditationIdParamsSchema,
});

/**
 * Body JSON + base64 (mismo patrón que docs de tripulante).
 * Magic bytes deben coincidir con mimeType.
 */
export const createAccreditationDocumentBodySchema = z.object({
  documentTypeId: z.uuid(),
  fileName: z
    .string({ error: "Nombre de archivo requerido" })
    .trim()
    .min(1, "Nombre de archivo requerido")
    .max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1, "Archivo requerido"),
  /** ISO; obligatorio si el tipo requiresExpiry. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export const createAccreditationDocumentRequestSchema = z.object({
  params: accreditationIdParamsSchema,
  body: createAccreditationDocumentBodySchema,
});

export const createAccreditationDocumentResponseSchema =
  contractorOrgDocumentResponseSchema;

export const accreditationDocumentIdParamsSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
});

export const downloadAccreditationDocumentRequestSchema = z.object({
  params: accreditationDocumentIdParamsSchema,
});

export const deleteAccreditationDocumentRequestSchema = z.object({
  params: accreditationDocumentIdParamsSchema,
});

export const deleteAccreditationDocumentResponseSchema =
  contractorOrgDocumentResponseSchema;

/** Validar u observar un documento cargado. */
export const validateAccreditationDocumentBodySchema = z.object({
  status: z.enum(["validated", "observed"]),
  observation: z.string().trim().max(2000).optional().nullable(),
});

export const validateAccreditationDocumentRequestSchema = z.object({
  params: accreditationDocumentIdParamsSchema,
  body: validateAccreditationDocumentBodySchema,
});

export const validateAccreditationDocumentResponseSchema =
  contractorOrgDocumentResponseSchema;

export type ContractorOrgDocumentResponse = z.infer<
  typeof contractorOrgDocumentResponseSchema
>;
export type CreateAccreditationDocumentBody = z.infer<
  typeof createAccreditationDocumentBodySchema
>;
export type ValidateAccreditationDocumentBody = z.infer<
  typeof validateAccreditationDocumentBodySchema
>;
