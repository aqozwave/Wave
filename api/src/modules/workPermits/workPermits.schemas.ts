import { z } from "../../lib/zod.js";

/** Ciclo del permiso (diagrama P4/P6). */
export const workPermitStatusSchema = z.enum([
  "to_complete",
  "to_approve",
  "to_receive",
  "active",
  "to_verify",
  "closed",
  "no_closure",
]);

/** Org resumida. */
export const workPermitOrganizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    rut: z.string(),
  })
  .openapi("WorkPermitOrganization");

/** Tipo / nave resumidos. */
export const workPermitPermitTypeSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
  })
  .openapi("WorkPermitPermitType");

export const workPermitLocationSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
  })
  .openapi("WorkPermitLocation");

/** Aviso origen. */
export const workPermitNoticeSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
  })
  .openapi("WorkPermitNotice");

/** Permiso de trabajo PT-NNNN. */
export const workPermitResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    code: z.string(),
    workNoticeId: z.uuid(),
    workNotice: workPermitNoticeSchema,
    organizationId: z.uuid(),
    organization: workPermitOrganizationSchema,
    permitTypeId: z.uuid(),
    permitType: workPermitPermitTypeSchema,
    locationId: z.uuid(),
    location: workPermitLocationSchema,
    scheduledDate: z.string(),
    description: z.string().nullable(),
    status: workPermitStatusSchema,
    /** Motivo de la última devolución; null si nunca se devolvió o se aprobó después. */
    reviewNote: z.string().nullable(),
    createdById: z.uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("WorkPermit");

/** Query GET /work-permits. */
export const listWorkPermitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  status: workPermitStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export const listWorkPermitsRequestSchema = z.object({
  query: listWorkPermitsQuerySchema,
});

export const listWorkPermitsResponseSchema = z
  .object({
    items: z.array(workPermitResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListWorkPermitsResponse");

/**
 * Body POST /work-permits — Prevención crea el PT desde un aviso.
 * Copia org/tipo/nave/fecha del aviso; status inicial to_complete.
 */
export const createWorkPermitBodySchema = z.object({
  workNoticeId: z.uuid(),
  /** Opcional: sobrescribe descripción del aviso. */
  description: z.string().trim().max(2000).nullable().optional(),
});

export const createWorkPermitRequestSchema = z.object({
  body: createWorkPermitBodySchema,
});

export const createWorkPermitResponseSchema = workPermitResponseSchema;

export const getWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const getWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/submit — enviar a aprobación. */
export const submitWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const submitWorkPermitResponseSchema = workPermitResponseSchema;

/** Body devolver con observación (P6b mínimo). */
export const workPermitReviewNoteBodySchema = z.object({
  reviewNote: z
    .string({ error: "La nota es requerida" })
    .trim()
    .min(1, "La nota es requerida")
    .max(2000),
});

/** POST /work-permits/:id/approve — Prevención aprueba → por recibir. */
export const approveWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const approveWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/return — Prevención devuelve → por completar. */
export const returnWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitReviewNoteBodySchema,
});

export const returnWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/receive — capitán recibe → autorizado a bordo. */
export const receiveWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const receiveWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/reject-receipt — capitán no autoriza → vuelve a Prevención. */
export const rejectReceiptWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitReviewNoteBodySchema,
});

export const rejectReceiptWorkPermitResponseSchema = workPermitResponseSchema;

/** Etapa del checklist del PT. */
export const workPermitChecklistStageSchema = z.enum([
  "contractor",
  "reception",
  "closure",
]);

/** Valor de respuesta de un ítem. */
export const workPermitChecklistAnswerValueSchema = z.enum(["yes", "no", "na"]);

/** Persona asignada al PT. */
export const workPermitPersonSchema = z
  .object({
    personId: z.uuid(),
    fullName: z.string(),
    rut: z.string(),
    position: z.string().nullable(),
    presentAt: z.string().datetime().nullable(),
  })
  .openapi("WorkPermitPerson");

export const listWorkPermitPeopleRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const listWorkPermitPeopleResponseSchema = z
  .object({
    items: z.array(workPermitPersonSchema),
  })
  .openapi("ListWorkPermitPeopleResponse");

/** PUT /work-permits/:id/people — reemplaza el set de personal. */
export const putWorkPermitPeopleBodySchema = z.object({
  personIds: z.array(z.uuid()).max(100),
});

export const putWorkPermitPeopleRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: putWorkPermitPeopleBodySchema,
});

export const putWorkPermitPeopleResponseSchema =
  listWorkPermitPeopleResponseSchema;

/** Ítem de checklist con respuesta opcional. */
export const workPermitChecklistItemSchema = z
  .object({
    checklistItemId: z.uuid(),
    order: z.number().int().positive(),
    text: z.string(),
    answer: workPermitChecklistAnswerValueSchema.nullable(),
    answeredAt: z.string().datetime().nullable(),
  })
  .openapi("WorkPermitChecklistItem");

export const getWorkPermitChecklistRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  query: z.object({
    stage: workPermitChecklistStageSchema.default("contractor"),
  }),
});

export const getWorkPermitChecklistResponseSchema = z
  .object({
    stage: workPermitChecklistStageSchema,
    items: z.array(workPermitChecklistItemSchema),
  })
  .openapi("GetWorkPermitChecklistResponse");

/** PUT /work-permits/:id/checklist — guarda respuestas de una etapa. */
export const putWorkPermitChecklistBodySchema = z.object({
  stage: workPermitChecklistStageSchema.default("contractor"),
  answers: z
    .array(
      z.object({
        checklistItemId: z.uuid(),
        answer: workPermitChecklistAnswerValueSchema,
      }),
    )
    .max(200),
});

export const putWorkPermitChecklistRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: putWorkPermitChecklistBodySchema,
});

export const putWorkPermitChecklistResponseSchema =
  getWorkPermitChecklistResponseSchema;

export type WorkPermitResponse = z.infer<typeof workPermitResponseSchema>;
export type ListWorkPermitsQuery = z.infer<typeof listWorkPermitsQuerySchema>;
export type CreateWorkPermitBody = z.infer<typeof createWorkPermitBodySchema>;
export type WorkPermitReviewNoteBody = z.infer<
  typeof workPermitReviewNoteBodySchema
>;
export type PutWorkPermitPeopleBody = z.infer<
  typeof putWorkPermitPeopleBodySchema
>;
export type PutWorkPermitChecklistBody = z.infer<
  typeof putWorkPermitChecklistBodySchema
>;
export type WorkPermitChecklistStage = z.infer<
  typeof workPermitChecklistStageSchema
>;

/** Query GET /work-permits/:id/history (activity_logs del PT). */
export const listWorkPermitHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).optional(),
  success: z.enum(["true", "false"]).optional(),
});

export const listWorkPermitHistoryRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  query: listWorkPermitHistoryQuerySchema,
});

/** Evento legible del historial del PT. */
export const workPermitHistoryItemSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.string().datetime(),
    event: z.string(),
    role: z.string().nullable(),
    user: z.string().nullable(),
    detail: z.string().nullable(),
    result: z.string(),
    resultTone: z.enum(["success", "warning", "danger", "info", "neutral"]),
    success: z.boolean(),
    action: z.string(),
    resource: z.string(),
  })
  .openapi("WorkPermitHistoryItem");

export const listWorkPermitHistoryResponseSchema = z
  .object({
    items: z.array(workPermitHistoryItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListWorkPermitHistoryResponse");

export type ListWorkPermitHistoryQuery = z.infer<
  typeof listWorkPermitHistoryQuerySchema
>;
