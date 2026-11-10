import { z } from "../../lib/zod.js";

/** Tope de etapas por flujo (decisión producto 2026-11-10). */
export const MAX_APPROVAL_FLOW_STAGES = 8;

/** Actor de una etapa (P16). */
export const approvalFlowStageActorSchema = z.enum([
  "requesting_area",
  "prevention",
  "contractor",
  "captain",
]);

/** Momento de una etapa. */
export const approvalFlowStageMomentSchema = z.enum([
  "before",
  "on_arrival",
  "on_finish",
]);

/** Etapa en respuestas de API. */
export const approvalFlowStageResponseSchema = z
  .object({
    id: z.uuid(),
    flowId: z.uuid(),
    position: z.number().int().min(1).max(MAX_APPROVAL_FLOW_STAGES),
    key: z.string(),
    label: z.string(),
    actor: approvalFlowStageActorSchema,
    moment: approvalFlowStageMomentSchema,
    requiresSignature: z.boolean(),
    mandatory: z.boolean(),
    fixed: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ApprovalFlowStage");

/** Fila de listado P16 (sin etapas embebidas; solo conteos). */
export const approvalFlowListItemSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    copiedFromId: z.uuid().nullable(),
    active: z.boolean(),
    stageCount: z.number().int().nonnegative(),
    typeCount: z.number().int().nonnegative(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ApprovalFlowListItem");

/** Query GET /approval-flows. */
export const listApprovalFlowsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().trim().optional(),
});

export const listApprovalFlowsRequestSchema = z.object({
  query: listApprovalFlowsQuerySchema,
});

export const listApprovalFlowsResponseSchema = z
  .object({
    items: z.array(approvalFlowListItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListApprovalFlowsResponse");

/** Detalle P15e/P15f: flujo + etapas ordenadas. */
export const approvalFlowDetailSchema = approvalFlowListItemSchema
  .extend({
    stages: z.array(approvalFlowStageResponseSchema),
  })
  .openapi("ApprovalFlowDetail");

export const approvalFlowIdParamsSchema = z.object({ id: z.uuid() });

export const getApprovalFlowRequestSchema = z.object({
  params: approvalFlowIdParamsSchema,
});

export const getApprovalFlowResponseSchema = approvalFlowDetailSchema;

/**
 * Código de flujo: letras, dígitos y guión (EST, EST-C).
 * Se normaliza a mayúsculas.
 */
const approvalFlowCodeSchema = z
  .string({ error: "Código es requerido" })
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9][A-Z0-9-]{0,14}$/.test(v), {
    message: "Código: 1–15 caracteres (letras, dígitos, guión)",
  });

/**
 * Body POST /approval-flows (P16m · Nuevo flujo = copia editable).
 * Por defecto copia el EST de la empresa.
 */
export const createApprovalFlowBodySchema = z.object({
  businessId: z.uuid(),
  code: approvalFlowCodeSchema,
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(2, "Nombre: mínimo 2 caracteres")
    .max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  /** Flujo origen; si falta, se usa EST de esa empresa. */
  sourceFlowId: z.uuid().optional(),
  /**
   * Cuántas etapas debe tener la copia (1..8).
   * Si es menor que el origen, toma las primeras N.
   * Si es mayor, rellena con etapas editables placeholder.
   */
  stageCount: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_APPROVAL_FLOW_STAGES)
    .optional(),
});

export const createApprovalFlowRequestSchema = z.object({
  body: createApprovalFlowBodySchema,
});

export const createApprovalFlowResponseSchema = approvalFlowDetailSchema;

/**
 * PATCH /approval-flows/:id — nombre/desc/activo (no sistema).
 */
export const updateApprovalFlowBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "" ? null : v)),
    active: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.active !== undefined,
    { message: "Enviá al menos un campo a actualizar" },
  );

export const updateApprovalFlowRequestSchema = z.object({
  params: approvalFlowIdParamsSchema,
  body: updateApprovalFlowBodySchema,
});

export const updateApprovalFlowResponseSchema = approvalFlowDetailSchema;

/** Clave estable de etapa (snake_case). */
const stageKeySchema = z
  .string({ error: "Clave es requerida" })
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[a-z][a-z0-9_]{0,39}$/.test(v), {
    message: "Clave: snake_case, 1–40 caracteres",
  });

/** Body POST …/stages (etapa extra; fixed=false). */
export const createApprovalFlowStageBodySchema = z.object({
  key: stageKeySchema,
  label: z
    .string({ error: "Qué se hace es requerido" })
    .trim()
    .min(3)
    .max(300),
  actor: approvalFlowStageActorSchema,
  moment: approvalFlowStageMomentSchema,
  requiresSignature: z.boolean().default(false),
  mandatory: z.boolean().default(true),
});

export const createApprovalFlowStageRequestSchema = z.object({
  params: approvalFlowIdParamsSchema,
  body: createApprovalFlowStageBodySchema,
});

export const createApprovalFlowStageResponseSchema = approvalFlowDetailSchema;

/** Params flujo + etapa. */
export const approvalFlowStageParamsSchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
});

/** Body PATCH …/stages/:stageId. */
export const updateApprovalFlowStageBodySchema = z
  .object({
    label: z.string().trim().min(3).max(300).optional(),
    actor: approvalFlowStageActorSchema.optional(),
    moment: approvalFlowStageMomentSchema.optional(),
    requiresSignature: z.boolean().optional(),
    mandatory: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.label !== undefined ||
      v.actor !== undefined ||
      v.moment !== undefined ||
      v.requiresSignature !== undefined ||
      v.mandatory !== undefined,
    { message: "Enviá al menos un campo a actualizar" },
  );

export const updateApprovalFlowStageRequestSchema = z.object({
  params: approvalFlowStageParamsSchema,
  body: updateApprovalFlowStageBodySchema,
});

export const updateApprovalFlowStageResponseSchema = approvalFlowDetailSchema;

export const deleteApprovalFlowStageRequestSchema = z.object({
  params: approvalFlowStageParamsSchema,
});

export const deleteApprovalFlowStageResponseSchema = approvalFlowDetailSchema;

/** DELETE /approval-flows/:id — soft-delete (solo personalizados). */
export const deleteApprovalFlowRequestSchema = z.object({
  params: approvalFlowIdParamsSchema,
});

export const deleteApprovalFlowResponseSchema = approvalFlowDetailSchema;

export type ListApprovalFlowsQuery = z.infer<
  typeof listApprovalFlowsQuerySchema
>;
export type ApprovalFlowListItem = z.infer<typeof approvalFlowListItemSchema>;
export type ApprovalFlowDetail = z.infer<typeof approvalFlowDetailSchema>;
export type CreateApprovalFlowBody = z.infer<
  typeof createApprovalFlowBodySchema
>;
export type UpdateApprovalFlowBody = z.infer<
  typeof updateApprovalFlowBodySchema
>;
export type CreateApprovalFlowStageBody = z.infer<
  typeof createApprovalFlowStageBodySchema
>;
export type UpdateApprovalFlowStageBody = z.infer<
  typeof updateApprovalFlowStageBodySchema
>;
