import { z } from "../../lib/zod.js";

/** Criticidad del tipo (chip en P14/P15). */
export const permitCriticalitySchema = z.enum(["low", "medium", "high"]);

/** Modo AST cuando requiresAst=true. */
export const permitAstModeSchema = z.enum(["form", "pdf", "both"]);

/** Un tipo de permiso en respuestas de API. */
export const permitTypeResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    code: z.string(),
    name: z.string(),
    criticality: permitCriticalitySchema,
    requiresAst: z.boolean(),
    astMode: permitAstModeSchema.nullable(),
    description: z.string().nullable(),
    active: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PermitType");

/** Query GET /permit-types: paginación + filtros. */
export const listPermitTypesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** Superadmin: filtrar por empresa. Admin/otros: se ignora (usa la suya). */
  businessId: z.uuid().optional(),
  /** Si true, solo activos; si false, solo desactivados; omitido = todos no borrados. */
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  /** Búsqueda por código o nombre (case-insensitive). */
  search: z.string().trim().optional(),
});

export const listPermitTypesRequestSchema = z.object({
  query: listPermitTypesQuerySchema,
});

export const listPermitTypesResponseSchema = z
  .object({
    items: z.array(permitTypeResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListPermitTypesResponse");

/** Params `:id` uuid. */
export const permitTypeIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getPermitTypeRequestSchema = z.object({
  params: permitTypeIdParamsSchema,
});

export const getPermitTypeResponseSchema = permitTypeResponseSchema;

/** Código de tipo: 2–4 letras mayúsculas (ALT, CAL, BUC…). */
const permitTypeCodeSchema = z
  .string({ error: "Código es requerido" })
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2,4}$/.test(v), {
    message: "El código debe tener 2 a 4 letras",
  });

/**
 * Shape base (sin refine) para poder usar .partial() en update (Zod 4).
 * La regla requiresAst ↔ astMode va en create/update por separado.
 */
const permitTypeFieldsObjectSchema = z.object({
  code: permitTypeCodeSchema,
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido"),
  criticality: permitCriticalitySchema,
  requiresAst: z.boolean().optional(),
  astMode: permitAstModeSchema.nullable().optional(),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v.length === 0 ? undefined : v)),
  /** Superadmin: empresa dueña al crear. */
  businessId: z.uuid().optional(),
  active: z.boolean().optional(),
});

/** Create: si requiresAst=true, astMode obligatorio. */
export const createPermitTypeBodySchema = permitTypeFieldsObjectSchema.superRefine(
  (body, ctx) => {
    const requiresAst = body.requiresAst ?? false;
    if (requiresAst && (body.astMode === undefined || body.astMode === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["astMode"],
        message: "astMode es requerido cuando requiresAst es true",
      });
    }
  },
);

export const createPermitTypeRequestSchema = z.object({
  body: createPermitTypeBodySchema,
});

export const createPermitTypeResponseSchema = permitTypeResponseSchema;

/** Update: al menos un campo; si manda requiresAst=true, exige astMode. */
export const updatePermitTypeBodySchema = permitTypeFieldsObjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  })
  .superRefine((body, ctx) => {
    if (body.requiresAst === true && body.astMode == null) {
      ctx.addIssue({
        code: "custom",
        path: ["astMode"],
        message: "astMode es requerido cuando requiresAst es true",
      });
    }
  });

export const updatePermitTypeRequestSchema = z.object({
  params: permitTypeIdParamsSchema,
  body: updatePermitTypeBodySchema,
});

export const updatePermitTypeResponseSchema = permitTypeResponseSchema;

export const deletePermitTypeRequestSchema = z.object({
  params: permitTypeIdParamsSchema,
});

export const deletePermitTypeResponseSchema = permitTypeResponseSchema;

/** kind de exigencia (P15 columna Tipo). */
export const permitRequirementKindSchema = z.enum([
  "document",
  "training",
  "checklist",
]);

/** Aplica a (empresa / persona / permiso). */
export const permitRequirementScopeSchema = z.enum([
  "company",
  "person",
  "permit",
]);

/** Momento (antes / cierre). */
export const permitRequirementMomentSchema = z.enum(["before", "closure"]);

/** Pack «los 8» de habilitación. */
export const accreditationScopeSchema = z.enum(["company", "person"]);

/** Tipo de documento embebido cuando hay FK. */
export const permitRequirementDocumentTypeSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
  })
  .nullable();

/** Una exigencia del tipo de permiso. */
export const permitTypeRequirementResponseSchema = z
  .object({
    id: z.uuid(),
    permitTypeId: z.uuid(),
    key: z.string(),
    kind: permitRequirementKindSchema,
    scope: permitRequirementScopeSchema,
    moment: permitRequirementMomentSchema,
    mandatory: z.boolean(),
    documentTypeId: z.uuid().nullable(),
    documentType: permitRequirementDocumentTypeSchema,
    accreditationScope: accreditationScopeSchema.nullable(),
    trainingCode: z.string().nullable(),
    trainingId: z.uuid().nullable(),
    training: z
      .object({
        id: z.uuid(),
        code: z.string(),
        name: z.string(),
      })
      .nullable(),
    label: z.string(),
    active: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PermitTypeRequirement");

export const listPermitTypeRequirementsRequestSchema = z.object({
  params: permitTypeIdParamsSchema,
});

export const listPermitTypeRequirementsResponseSchema = z
  .object({
    items: z.array(permitTypeRequirementResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListPermitTypeRequirementsResponse");

/** Un ítem del checklist del tipo. */
export const permitChecklistItemResponseSchema = z
  .object({
    id: z.uuid(),
    permitTypeId: z.uuid(),
    order: z.number().int().positive(),
    text: z.string(),
    active: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PermitChecklistItem");

export const listPermitChecklistItemsRequestSchema = z.object({
  params: permitTypeIdParamsSchema,
});

export const listPermitChecklistItemsResponseSchema = z
  .object({
    items: z.array(permitChecklistItemResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListPermitChecklistItemsResponse");

export type ListPermitTypesQuery = z.infer<typeof listPermitTypesQuerySchema>;
export type PermitTypeResponse = z.infer<typeof permitTypeResponseSchema>;
export type CreatePermitTypeBody = z.infer<typeof createPermitTypeBodySchema>;
export type UpdatePermitTypeBody = z.infer<typeof updatePermitTypeBodySchema>;
export type PermitTypeRequirementResponse = z.infer<
  typeof permitTypeRequirementResponseSchema
>;
export type PermitChecklistItemResponse = z.infer<
  typeof permitChecklistItemResponseSchema
>;
