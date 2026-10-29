import { z } from "../../lib/zod.js";

/** Subtipos del maestro (Figma + seed HR). */
export const documentSubtypeSchema = z.enum([
  "general",
  "finiquito",
  "requerimiento",
  "prevencion",
  "maritimo",
  "activo",
]);

/** A quién aplica el tipo (Figma «Aplica a»). */
export const documentAppliesToSchema = z.enum([
  "crew",
  "external",
  "crew_and_external",
]);

/**
 * Roles que suben / ven el documento (Figma «Lo suben» / «Lo ven»).
 * Valores estables; labels en UI.
 */
export const documentActorScopeSchema = z.enum([
  "prevention_or_admin",
  "prevention_admin_hr_assets",
  "admin",
  "hr",
  "assets",
]);

/** Legacy: quién ve en el expediente (se sincroniza con crewCanView). */
export const documentVisibilitySchema = z.enum([
  "nobody",
  "employee",
  "employee_supervisor",
  "supervisor",
]);

/** Código HR: 2 a 4 letras (Figma D41). */
const documentCodeSchema = z
  .string({ error: "Código es requerido" })
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2,4}$/.test(v), {
    message: "El código debe tener 2 a 4 letras",
  });

/** Campos create / update. */
export const documentTypeFieldsSchema = z.object({
  code: documentCodeSchema,
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase()),
  subtype: documentSubtypeSchema.optional(),
  appliesTo: documentAppliesToSchema.optional(),
  requiresExpiry: z.boolean().optional(),
  uploadBy: documentActorScopeSchema.optional(),
  viewBy: documentActorScopeSchema.optional(),
  crewCanView: z.boolean().optional(),
  /** Legacy opcional; si no viene, se deriva de crewCanView. */
  visibility: documentVisibilitySchema.optional(),
  businessId: z.uuid().optional(),
  state: z.boolean().optional(),
});

export const documentTypeResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    code: z.string(),
    name: z.string(),
    subtype: z.string(),
    appliesTo: z.string(),
    requiresExpiry: z.boolean(),
    uploadBy: z.string(),
    viewBy: z.string(),
    crewCanView: z.boolean(),
    visibility: z.string(),
    businessId: z.uuid(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("DocumentType");

export const createDocumentTypeBodySchema = documentTypeFieldsSchema;
export const createDocumentTypeRequestSchema = z.object({
  body: createDocumentTypeBodySchema,
});

export const listDocumentTypesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
  businessId: z.uuid().optional(),
  subtype: documentSubtypeSchema.optional(),
  appliesTo: documentAppliesToSchema.optional(),
  search: z.string().trim().optional(),
});

export const listDocumentTypesRequestSchema = z.object({
  query: listDocumentTypesQuerySchema,
});

export const listDocumentTypesResponseSchema = z
  .object({
    items: z.array(documentTypeResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListDocumentTypesResponse");

export const documentTypeIdParamsSchema = z.object({ id: z.uuid() });

export const getDocumentTypeRequestSchema = z.object({
  params: documentTypeIdParamsSchema,
});

export const deleteDocumentTypeRequestSchema = z.object({
  params: documentTypeIdParamsSchema,
});

export const updateDocumentTypeBodySchema = documentTypeFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateDocumentTypeRequestSchema = z.object({
  params: documentTypeIdParamsSchema,
  body: updateDocumentTypeBodySchema,
});

export const createDocumentTypeResponseSchema = documentTypeResponseSchema;
export const getDocumentTypeResponseSchema = documentTypeResponseSchema;
export const updateDocumentTypeResponseSchema = documentTypeResponseSchema;
export const deleteDocumentTypeResponseSchema = documentTypeResponseSchema;

export type CreateDocumentTypeBody = z.infer<typeof createDocumentTypeBodySchema>;
export type ListDocumentTypesQuery = z.infer<typeof listDocumentTypesQuerySchema>;
export type DocumentTypeResponse = z.infer<typeof documentTypeResponseSchema>;
export type UpdateDocumentTypeBody = z.infer<typeof updateDocumentTypeBodySchema>;
