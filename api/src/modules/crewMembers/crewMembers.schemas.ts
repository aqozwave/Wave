import { chileanRunSchema } from "../../lib/rut.js";
import { z } from "../../lib/zod.js";

/** Campos de ficha de tripulante (alta). */
export const crewMemberFieldsSchema = z.object({
  run: chileanRunSchema,
  firstName: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase()),
  lastName: z
    .string({ error: "Apellido es requerido" })
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase()),
  email: z.email().trim().toLowerCase(),
  birthDate: z.string().datetime().nullable().optional(),
  nationality: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  direction: z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase())
    .nullable()
    .optional(),
  observation: z.string().trim().nullable().optional(),
  /** ISO 8601; vigencia del libro de embarque. */
  boardingBookValidUntil: z.string().datetime(),
  /** Obligatorio para superadmin al crear; admin usa el suyo. */
  businessId: z.uuid().optional(),
  locationId: z.uuid(),
  areaId: z.uuid().nullable().optional(),
  rankId: z.uuid().nullable().optional(),
  academicDegreeId: z.uuid().nullable().optional(),
  competencyCertificateId: z.uuid().nullable().optional(),
  /** Cuenta portal vinculada (1:1). */
  userId: z.uuid().nullable().optional(),
  state: z.boolean().optional(),
});

/** Tripulante en respuestas de API. */
export const crewMemberResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    run: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    birthDate: z.string().datetime().nullable(),
    nationality: z.string().nullable(),
    phone: z.string().nullable(),
    direction: z.string().nullable(),
    observation: z.string().nullable(),
    boardingBookValidUntil: z.string().datetime(),
    businessId: z.uuid(),
    locationId: z.uuid(),
    areaId: z.uuid().nullable(),
    rankId: z.uuid().nullable(),
    academicDegreeId: z.uuid().nullable(),
    competencyCertificateId: z.uuid().nullable(),
    userId: z.uuid().nullable(),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /**
     * % de cursos obligatorios al día (valid + expiring_soon).
     * null = sin cursos obligatorios asignados (mostrar "—" en UI).
     */
    courseCompliancePercent: z.number().int().min(0).max(100).nullable(),
  })
  .openapi("CrewMember");

export const createCrewMemberBodySchema = crewMemberFieldsSchema;

export const createCrewMemberRequestSchema = z.object({
  body: createCrewMemberBodySchema,
});

/** Query listado: página, búsqueda, filtros. */
export const listCrewMembersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  businessId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const listCrewMembersRequestSchema = z.object({
  query: listCrewMembersQuerySchema,
});

export const listCrewMembersResponseSchema = z
  .object({
    items: z.array(crewMemberResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListCrewMembersResponse");

export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getCrewMemberRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

export const deleteCrewMemberRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/** Body PATCH: parcial; locationId opcional al editar. */
export const updateCrewMemberBodySchema = crewMemberFieldsSchema
  .partial()
  .extend({
    locationId: z.uuid().optional(),
    boardingBookValidUntil: z.string().datetime().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateCrewMemberRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: updateCrewMemberBodySchema,
});

export const createCrewMemberResponseSchema = crewMemberResponseSchema;
export const getCrewMemberResponseSchema = crewMemberResponseSchema;
export const updateCrewMemberResponseSchema = crewMemberResponseSchema;
export const deleteCrewMemberResponseSchema = crewMemberResponseSchema;

export type CreateCrewMemberBody = z.infer<typeof createCrewMemberBodySchema>;
export type ListCrewMembersQuery = z.infer<typeof listCrewMembersQuerySchema>;
export type CrewMemberResponse = z.infer<typeof crewMemberResponseSchema>;
export type UpdateCrewMemberBody = z.infer<typeof updateCrewMemberBodySchema>;

/** Roles permitidos en Acceso (Figma D45/D46: User ↔ Colaborador). */
export const crewAccessRoleKeySchema = z.enum(["user", "colaborador"]);

/** Usuario vinculado en la pestaña Acceso. */
export const crewAccessUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    run: z.string(),
    internalRol: z.string(),
    roleKey: z.string().nullable(),
    roleName: z.string().nullable(),
    dataScope: z.string().nullable(),
    locationId: z.uuid().nullable(),
    locationName: z.string().nullable(),
    lastLoginAt: z.string().datetime().nullable(),
    confirmed: z.boolean(),
    state: z.boolean(),
  })
  .openapi("CrewAccessUser");

/**
 * Estado Acceso del tripulante (Figma D44 / D44b).
 * linked=false → empty state; linked=true → ficha de cuenta.
 */
export const crewAccessResponseSchema = z
  .object({
    linked: z.boolean(),
    /** true si hay cuenta pero aún no confirmó / no definió clave. */
    invitePending: z.boolean(),
    /** Resumen legible del alcance (ej. "User · Wellboat Aurora"). */
    scopeSummary: z.string().nullable(),
    user: crewAccessUserSchema.nullable(),
  })
  .openapi("CrewAccess");

export const getCrewMemberAccessRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

/** Body otorgar acceso: invita o vincula cuenta existente. */
export const grantCrewMemberAccessBodySchema = z.object({
  /** Si se omite, usa el email del tripulante. */
  email: z.email().trim().toLowerCase().optional(),
  /** Rol inicial; por defecto User (tripulante de nave). */
  roleKey: crewAccessRoleKeySchema.optional().default("user"),
});

export const grantCrewMemberAccessRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: grantCrewMemberAccessBodySchema,
});

/** Body cambiar rol User ↔ Colaborador (solo admin). */
export const changeCrewMemberAccessRoleBodySchema = z.object({
  roleKey: crewAccessRoleKeySchema,
});

export const changeCrewMemberAccessRoleRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: changeCrewMemberAccessRoleBodySchema,
});

export const revokeCrewMemberAccessRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

export type GrantCrewMemberAccessBody = z.infer<
  typeof grantCrewMemberAccessBodySchema
>;
export type ChangeCrewMemberAccessRoleBody = z.infer<
  typeof changeCrewMemberAccessRoleBodySchema
>;
export type CrewAccessResponse = z.infer<typeof crewAccessResponseSchema>;

/**
 * Categoría de evento en bitácora (Figma D31 filtros).
 * observation / sanction / boarding también salen de CrewMemberLogEntry.
 */
export const crewHistoryCategorySchema = z.enum([
  "all",
  "contract",
  "document",
  "course",
  "observation",
  "sanction",
  "boarding",
]);

/** Query GET /crew-members/:id/history (AQO-68 · D31). */
export const listCrewMemberHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  category: crewHistoryCategorySchema.optional().default("all"),
});

export const listCrewMemberHistoryRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  query: listCrewMemberHistoryQuerySchema,
});

/** Origen del ítem en la timeline (para UI: solo log_entry se puede borrar). */
export const crewHistorySourceSchema = z.enum([
  "audit",
  "document",
  "log_entry",
]);

/** Ítem timeline de bitácora. */
export const crewHistoryItemSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime(),
    title: z.string(),
    detail: z.string().nullable(),
    category: z.enum([
      "contract",
      "document",
      "course",
      "observation",
      "sanction",
      "boarding",
    ]),
    categoryLabel: z.string(),
    statusLabel: z.string().nullable(),
    statusTone: z.enum(["success", "warning", "danger", "info", "neutral"]),
    actor: z.string().nullable(),
    /** Nombre de archivo adjunto si aplica (docs). */
    attachmentName: z.string().nullable(),
    /** De dónde salió el evento. */
    source: crewHistorySourceSchema,
  })
  .openapi("CrewHistoryItem");

/** Conteos del resumen lateral D31. */
export const crewHistorySummarySchema = z
  .object({
    documents: z.number().int().nonnegative(),
    courses: z.number().int().nonnegative(),
    boardings: z.number().int().nonnegative(),
    observations: z.number().int().nonnegative(),
    sanctions: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .openapi("CrewHistorySummary");

export const listCrewMemberHistoryResponseSchema = z
  .object({
    items: z.array(crewHistoryItemSchema),
    summary: crewHistorySummarySchema,
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListCrewMemberHistoryResponse");

/** kind de entrada manual de bitácora. */
export const crewLogEntryKindSchema = z.enum([
  "observation",
  "sanction",
  "boarding",
]);

/**
 * Adjunto opcional al crear entrada (solo amonestación).
 * Crea CrewMemberDocument y lo vincula; aparece en tab Documentos.
 */
export const createCrewMemberLogEntryAttachmentSchema = z.object({
  documentTypeId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** Body POST /crew-members/:id/log-entries. */
export const createCrewMemberLogEntryBodySchema = z
  .object({
    kind: crewLogEntryKindSchema,
    note: z
      .string({ error: "La nota es requerida" })
      .trim()
      .min(1, "La nota es requerida")
      .max(2000),
    /** ISO 8601; si falta, la API usa ahora. */
    occurredAt: z.string().datetime().optional(),
    /** Solo permitido si kind = sanction. */
    attachment: createCrewMemberLogEntryAttachmentSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.attachment && val.kind !== "sanction") {
      ctx.addIssue({
        code: "custom",
        path: ["attachment"],
        message: "El adjunto solo aplica a amonestaciones",
      });
    }
  });

export const createCrewMemberLogEntryRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberLogEntryBodySchema,
});

/** Respuesta de una entrada de bitácora. */
export const crewMemberLogEntryResponseSchema = z
  .object({
    id: z.uuid(),
    crewMemberId: z.uuid(),
    kind: crewLogEntryKindSchema,
    note: z.string(),
    occurredAt: z.string().datetime(),
    documentId: z.uuid().nullable(),
    createdById: z.uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberLogEntry");

export const createCrewMemberLogEntryResponseSchema =
  crewMemberLogEntryResponseSchema;

export const deleteCrewMemberLogEntryParamsSchema = z.object({
  id: z.uuid(),
  entryId: z.uuid(),
});

export const deleteCrewMemberLogEntryRequestSchema = z.object({
  params: deleteCrewMemberLogEntryParamsSchema,
});

export const deleteCrewMemberLogEntryResponseSchema =
  crewMemberLogEntryResponseSchema;

export type ListCrewMemberHistoryQuery = z.infer<
  typeof listCrewMemberHistoryQuerySchema
>;
export type CrewHistoryItem = z.infer<typeof crewHistoryItemSchema>;
export type CreateCrewMemberLogEntryBody = z.infer<
  typeof createCrewMemberLogEntryBodySchema
>;
export type CrewMemberLogEntryResponse = z.infer<
  typeof crewMemberLogEntryResponseSchema
>;
