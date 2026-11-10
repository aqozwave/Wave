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
});

export const createApprovalFlowRequestSchema = z.object({
  body: createApprovalFlowBodySchema,
});

export const createApprovalFlowResponseSchema = approvalFlowDetailSchema;

export type ListApprovalFlowsQuery = z.infer<
  typeof listApprovalFlowsQuerySchema
>;
export type ApprovalFlowListItem = z.infer<typeof approvalFlowListItemSchema>;
export type ApprovalFlowDetail = z.infer<typeof approvalFlowDetailSchema>;
export type CreateApprovalFlowBody = z.infer<
  typeof createApprovalFlowBodySchema
>;
