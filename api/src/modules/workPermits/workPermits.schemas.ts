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
    /** Snapshot de exigencias al crear (R-13); null en PT viejos. */
    requirementsSnapshot: z.unknown().nullable(),
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

/** DELETE /work-permits/:id — soft-delete (permiso deactivate). */
export const deleteWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const deleteWorkPermitResponseSchema = workPermitResponseSchema;

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

/**
 * Firma digital (pad PNG + nombre + aceptación).
 * Obligatoria en Aprobar / Autorizar a bordo / Cerrar / Sin cierre.
 */
export const workPermitDigitalSignatureBodySchema = z.object({
  signerName: z
    .string({ error: "El nombre del firmante es requerido" })
    .trim()
    .min(1, "El nombre del firmante es requerido")
    .max(200),
  /** Debe ser true: confirma que acepta firmar el hito. */
  accepted: z.literal(true),
  /** Data URL PNG del trazo (signature_pad). */
  signatureImage: z
    .string({ error: "La firma manuscrita es requerida" })
    .min(32, "La firma manuscrita es requerida")
    .max(500_000, "La imagen de firma es demasiado grande")
    .refine(
      (v) => v.startsWith("data:image/png;base64,"),
      "La firma debe ser una imagen PNG",
    ),
});

/** POST /work-permits/:id/approve — Prevención aprueba → por recibir. */
export const approveWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitDigitalSignatureBodySchema,
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
  body: workPermitDigitalSignatureBodySchema,
});

export const receiveWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/reject-receipt — capitán no autoriza → vuelve a Prevención. */
export const rejectReceiptWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitReviewNoteBodySchema,
});

export const rejectReceiptWorkPermitResponseSchema = workPermitResponseSchema;

/**
 * Body pedir cierre: observación opcional al capitán / Prevención.
 * Vacío o ausente = sin comentario.
 */
export const requestCloseWorkPermitBodySchema = z.object({
  observation: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .nullable(),
});

/** POST /work-permits/:id/request-close — contratista/staff pide cierre (P6a). */
export const requestCloseWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: requestCloseWorkPermitBodySchema,
});

export const requestCloseWorkPermitResponseSchema = workPermitResponseSchema;

export type RequestCloseWorkPermitBody = z.infer<
  typeof requestCloseWorkPermitBodySchema
>;

/** POST /work-permits/:id/close — capitán cierra el trabajo (P6b). */
export const closeWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitDigitalSignatureBodySchema,
});

export const closeWorkPermitResponseSchema = workPermitResponseSchema;

/** POST /work-permits/:id/reject-close — capitán deja sin cierre (P6b) + firma. */
export const rejectCloseWorkPermitRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: workPermitReviewNoteBodySchema.merge(
    workPermitDigitalSignatureBodySchema,
  ),
});

export const rejectCloseWorkPermitResponseSchema = workPermitResponseSchema;

export type WorkPermitDigitalSignatureBody = z.infer<
  typeof workPermitDigitalSignatureBodySchema
>;

/** Etapa del checklist del PT. */
export const workPermitChecklistStageSchema = z.enum([
  "contractor",
  "reception",
  "closure",
]);

/** Valor de respuesta de un ítem. */
export const workPermitChecklistAnswerValueSchema = z.enum(["yes", "no", "na"]);

/** Persona asignada al PT (+ readiness para revisión Prevención). */
export const workPermitPersonSchema = z
  .object({
    personId: z.uuid(),
    fullName: z.string(),
    rut: z.string(),
    position: z.string().nullable(),
    presentAt: z.string().datetime().nullable(),
    /** HAB vigente de la org (para abrir docs de la persona). */
    accreditationId: z.uuid().nullable(),
    packComplete: z.boolean(),
    pendingPackCodes: z.array(z.string()),
    absentPackCodes: z.array(z.string()),
    missingRequirementLabels: z.array(z.string()),
    pendingRequirementLabels: z.array(z.string()),
    absentRequirementLabels: z.array(z.string()),
    /** Pack + exigencias document/person del tipo OK. */
    docsOk: z.boolean(),
  })
  .openapi("WorkPermitPerson");

export const listWorkPermitPeopleRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const listWorkPermitPeopleResponseSchema = z
  .object({
    items: z.array(workPermitPersonSchema),
    personRequirementLabels: z.array(z.string()),
  })
  .openapi("ListWorkPermitPeopleResponse");

/**
 * Persona asignable al PT: pack + exigencias document/person del tipo.
 * Sirve al modal Completar para mostrar qué falta antes del PUT.
 */
export const workPermitAssignablePersonSchema = z
  .object({
    personId: z.uuid(),
    fullName: z.string(),
    rut: z.string(),
    position: z.string().nullable(),
    packComplete: z.boolean(),
    missingPackCodes: z.array(z.string()),
    /** Pack subido pero pendiente de validación Prevención. */
    pendingPackCodes: z.array(z.string()),
    /** Pack sin archivo. */
    absentPackCodes: z.array(z.string()),
    missingRequirementLabels: z.array(z.string()),
    missingRequirementCodes: z.array(z.string()),
    pendingRequirementLabels: z.array(z.string()),
    absentRequirementLabels: z.array(z.string()),
    /** HAB actual de la org (para ir a cargar docs faltantes). */
    accreditationId: z.uuid().nullable(),
    /**
     * true si el pack persona está completo (se puede asignar al PT).
     * Las exigencias de faena/capacitación se piden al enviar a aprobación.
     */
    canAssign: z.boolean(),
  })
  .openapi("WorkPermitAssignablePerson");

export const listWorkPermitAssignablePeopleRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const listWorkPermitAssignablePeopleResponseSchema = z
  .object({
    items: z.array(workPermitAssignablePersonSchema),
    /** Etiquetas de exigencias document/person del tipo (vacío si no hay). */
    personRequirementLabels: z.array(z.string()),
  })
  .openapi("ListWorkPermitAssignablePeopleResponse");

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

/** Estado de una exigencia en P13b. */
export const workPermitRequirementCheckStatusSchema = z.enum([
  "ok",
  "later",
  "missing",
  "not_applicable",
]);

/** Ítem de verificación de exigencias. */
export const workPermitRequirementCheckItemSchema = z
  .object({
    requirementId: z.uuid(),
    key: z.string(),
    kind: z.enum(["document", "training", "checklist"]),
    scope: z.enum(["company", "person", "permit"]),
    moment: z.enum(["before", "closure"]),
    mandatory: z.boolean(),
    label: z.string(),
    status: workPermitRequirementCheckStatusSchema,
    detail: z.string().nullable(),
  })
  .openapi("WorkPermitRequirementCheckItem");

/** GET /work-permits/requirements-check (P13b). */
export const workPermitRequirementsCheckQuerySchema = z.object({
  organizationId: z.uuid(),
  permitTypeId: z.uuid(),
});

export const workPermitRequirementsCheckRequestSchema = z.object({
  query: workPermitRequirementsCheckQuerySchema,
});

export const workPermitRequirementsCheckResponseSchema = z
  .object({
    organizationId: z.uuid(),
    organization: workPermitOrganizationSchema,
    permitTypeId: z.uuid(),
    permitType: workPermitPermitTypeSchema,
    accreditation: z
      .object({
        id: z.uuid(),
        code: z.string(),
        status: z.string(),
      })
      .nullable(),
    summary: z.object({
      ok: z.number().int().nonnegative(),
      later: z.number().int().nonnegative(),
      missing: z.number().int().nonnegative(),
      notApplicable: z.number().int().nonnegative(),
    }),
    items: z.array(workPermitRequirementCheckItemSchema),
    /** false si HAB no approved o hay missing mandatory before de empresa. */
    canCreate: z.boolean(),
  })
  .openapi("WorkPermitRequirementsCheckResponse");

export type WorkPermitRequirementsCheckQuery = z.infer<
  typeof workPermitRequirementsCheckQuerySchema
>;

/** Tipos de firma registrados en hitos del PT (P6c). */
export const workPermitSignatureKindSchema = z.enum([
  "prevention_approve",
  "captain_receive",
  "contractor_request_close",
  "captain_close",
  "captain_no_closure",
]);

/** Firma serializada para el documento imprimible. */
export const workPermitDocumentSignatureSchema = z
  .object({
    kind: workPermitSignatureKindSchema,
    label: z.string(),
    signerName: z.string(),
    signedAt: z.string().datetime(),
    note: z.string().nullable(),
    /** Trazo PNG (data URL) si hubo pad digital. */
    signatureImage: z.string().nullable(),
    /** ISO de aceptación; null si solo registro automático. */
    acceptedAt: z.string().datetime().nullable(),
  })
  .openapi("WorkPermitDocumentSignature");

/** GET /work-permits/:id/document — ficha imprimible (sin PDF). */
export const getWorkPermitDocumentRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

/** Empresa mandante (tenant) que emite el permiso. */
export const workPermitDocumentIssuerSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    rut: z.string().nullable(),
    giro: z.string().nullable(),
    commune: z.string().nullable(),
    city: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  })
  .openapi("WorkPermitDocumentIssuer");

export const workPermitDocumentResponseSchema = z
  .object({
    /** Empresa mandante (logo + datos en cabecera del documento). */
    issuer: workPermitDocumentIssuerSchema,
    permit: workPermitResponseSchema,
    people: z.array(
      z.object({
        fullName: z.string(),
        rut: z.string(),
        position: z.string().nullable(),
      }),
    ),
    checklist: z.array(
      z.object({
        order: z.number().int().positive(),
        text: z.string(),
        answer: z.enum(["yes", "no", "na"]),
      }),
    ),
    signatures: z.array(workPermitDocumentSignatureSchema),
  })
  .openapi("WorkPermitDocument");

export type WorkPermitDocumentResponse = z.infer<
  typeof workPermitDocumentResponseSchema
>;
