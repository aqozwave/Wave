import { chileanRunSchema } from "../../lib/rut.js";
import { z } from "../../lib/zod.js";

/** Relación laboral con el tenant (permanente / ocasional). */
export const contractorRoleSchema = z.enum(["permanent", "occasional"]);

/** Estados de HAB (mismo set que accreditations). */
export const contractorAccreditationStatusSchema = z.enum([
  "invited",
  "pending",
  "in_review",
  "observed",
  "approved",
  "rejected",
]);

/** Resumen de la HAB más reciente (columna Habilitación / Última revisión). */
export const contractorLatestAccreditationSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    status: contractorAccreditationStatusSchema,
    requestedAt: z.string().datetime().nullable(),
    submittedAt: z.string().datetime().nullable(),
    reviewedAt: z.string().datetime().nullable(),
  })
  .nullable();

/** Organización contratista en respuestas API. */
export const contractorOrganizationResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    name: z.string(),
    rut: z.string(),
    role: contractorRoleSchema,
    specialty: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    legalRepresentative: z.string().nullable(),
    address: z.string().nullable(),
    mutual: z.string().nullable(),
    supervisorName: z.string().nullable(),
    supervisorEmail: z.string().nullable(),
    prevencionistName: z.string().nullable(),
    prevencionistEmail: z.string().nullable(),
    subcontractors: z.string().nullable(),
    workDescription: z.string().nullable(),
    active: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /**
     * HAB más reciente (por createdAt). null = nunca solicitada.
     * UI Figma: columna Habilitación + Última revisión.
     */
    latestAccreditation: contractorLatestAccreditationSchema,
    /**
     * Conteo de personal externo. 0 hasta existir ContractorPerson (P2 personas).
     */
    personCount: z.number().int().nonnegative(),
  })
  .openapi("ContractorOrganization");

/** Query GET /contractors. */
export const listContractorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  role: contractorRoleSchema.optional(),
  /**
   * Filtra por estado de alguna HAB (aprox. columna Habilitación).
   * `none` = sin ninguna habilitación.
   */
  accreditationStatus: z
    .union([contractorAccreditationStatusSchema, z.literal("none")])
    .optional(),
  search: z.string().trim().optional(),
});

export const listContractorsRequestSchema = z.object({
  query: listContractorsQuerySchema,
});

export const listContractorsResponseSchema = z
  .object({
    items: z.array(contractorOrganizationResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListContractorsResponse");

export const contractorIdParamsSchema = z.object({ id: z.uuid() });

export const getContractorRequestSchema = z.object({
  params: contractorIdParamsSchema,
});

export const getContractorResponseSchema = contractorOrganizationResponseSchema;

/** Email opcional: "" / null → undefined (service → null en BD). */
const optionalEmailSchema = z
  .union([z.string().email("Email inválido"), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === "" || v === null ? undefined : v));

/** Texto opcional: "" / null → undefined (service → null en BD). */
const optionalTextSchema = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v) =>
    v === undefined || v === null || v === "" ? undefined : v,
  );

/**
 * Campos de alta/edición (sin refine previo para permitir .partial()).
 * name se normaliza a minúsculas en el service (mismo criterio Business).
 */
const contractorFieldsObjectSchema = z.object({
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .max(200),
  rut: chileanRunSchema,
  role: contractorRoleSchema,
  specialty: optionalTextSchema,
  contactName: optionalTextSchema,
  contactEmail: optionalEmailSchema,
  contactPhone: optionalTextSchema,
  legalRepresentative: optionalTextSchema,
  address: optionalTextSchema,
  mutual: optionalTextSchema,
  supervisorName: optionalTextSchema,
  supervisorEmail: optionalEmailSchema,
  prevencionistName: optionalTextSchema,
  prevencionistEmail: optionalEmailSchema,
  subcontractors: optionalTextSchema,
  workDescription: optionalTextSchema,
  /** Superadmin: empresa dueña al crear. */
  businessId: z.uuid().optional(),
  active: z.boolean().optional(),
});

export const createContractorBodySchema = contractorFieldsObjectSchema;

export const createContractorRequestSchema = z.object({
  body: createContractorBodySchema,
});

export const createContractorResponseSchema =
  contractorOrganizationResponseSchema;

export const updateContractorBodySchema = contractorFieldsObjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Enviá al menos un campo para actualizar",
  });

export const updateContractorRequestSchema = z.object({
  params: contractorIdParamsSchema,
  body: updateContractorBodySchema,
});

export const updateContractorResponseSchema =
  contractorOrganizationResponseSchema;

export const deleteContractorRequestSchema = z.object({
  params: contractorIdParamsSchema,
});

export const deleteContractorResponseSchema =
  contractorOrganizationResponseSchema;

/** Quién invitó (columna P9 «Invitado por»). */
export const contractorUserInvitedBySchema = z
  .object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
  })
  .openapi("ContractorUserInvitedBy");

/**
 * Usuario invitado de una org contratista (P9b).
 * invitePending = aún no confirmó / no definió clave.
 */
export const contractorUserResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    run: z.string(),
    confirmed: z.boolean(),
    invitePending: z.boolean(),
    state: z.boolean(),
    internalRol: z.string(),
    lastLoginAt: z.string().datetime().nullable(),
    accessExpiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    /** Null en usuarios legados o sin invitación registrada. */
    invitedBy: contractorUserInvitedBySchema.nullable(),
  })
  .openapi("ContractorUser");

/** Query GET /contractors/:id/users. */
export const listContractorUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listContractorUsersRequestSchema = z.object({
  params: contractorIdParamsSchema,
  query: listContractorUsersQuerySchema,
});

export const listContractorUsersResponseSchema = z
  .object({
    items: z.array(contractorUserResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListContractorUsersResponse");

/**
 * Body invitar usuario a la org (P9b).
 * Crea cuenta o vincula email existente del mismo tenant; envía reset.
 * roleKey: dueño (`contratista`) o faena (`contratista_faena`).
 */
export const inviteContractorUserBodySchema = z.object({
  email: z.email("Email inválido").trim().toLowerCase(),
  firstName: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .max(100),
  lastName: z
    .string({ error: "Apellido es requerido" })
    .trim()
    .min(1, "Apellido es requerido")
    .max(100),
  run: chileanRunSchema,
  /**
   * Rol portal del invitado.
   * Default: contratista (admin de la org). Faena = ver PT + pedir cierre.
   */
  roleKey: z
    .enum(["contratista", "contratista_faena"])
    .default("contratista"),
  /** Vencimiento opcional del acceso (ISO). */
  accessExpiresAt: z.string().datetime().nullable().optional(),
});

export const inviteContractorUserRequestSchema = z.object({
  params: contractorIdParamsSchema,
  body: inviteContractorUserBodySchema,
});

export const inviteContractorUserResponseSchema = contractorUserResponseSchema;

export type ContractorOrganizationResponse = z.infer<
  typeof contractorOrganizationResponseSchema
>;
export type ListContractorsQuery = z.infer<typeof listContractorsQuerySchema>;
export type CreateContractorBody = z.infer<typeof createContractorBodySchema>;
export type UpdateContractorBody = z.infer<typeof updateContractorBodySchema>;
export type ContractorUserResponse = z.infer<
  typeof contractorUserResponseSchema
>;
export type ListContractorUsersQuery = z.infer<
  typeof listContractorUsersQuerySchema
>;
export type InviteContractorUserBody = z.infer<
  typeof inviteContractorUserBodySchema
>;

/** Fila de pendientes del panel E3 (habilitado). */
export const contractorPortalPendingItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["observation", "document", "person", "permit"]),
  title: z.string(),
  detail: z.string().nullable(),
  appliesTo: z.string(),
  locationName: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  statusLabel: z.string(),
  statusTone: z.enum(["success", "warning", "danger", "info", "neutral"]),
  href: z.string().nullable(),
});

/**
 * Resumen del portal contratista (E3 / E3b).
 * Solo para usuarios con organizationId (sin permiso contractors.read).
 */
export const contractorPortalSummaryResponseSchema = z
  .object({
    organization: z.object({
      id: z.uuid(),
      name: z.string(),
      rut: z.string(),
      specialty: z.string().nullable(),
      role: z.string(),
    }),
    accreditation: z
      .object({
        id: z.uuid(),
        code: z.string(),
        status: z.enum([
          "invited",
          "pending",
          "in_review",
          "observed",
          "approved",
          "rejected",
        ]),
        message: z.string().nullable(),
        dueAt: z.string().datetime().nullable(),
        requestedAt: z.string().datetime().nullable(),
        submittedAt: z.string().datetime().nullable(),
        reviewedAt: z.string().datetime().nullable(),
      })
      .nullable(),
    /** Docs pack company: cargados / exigidos. */
    companyDocuments: z.object({
      uploaded: z.number().int().nonnegative(),
      required: z.number().int().nonnegative(),
    }),
    /** Personas activas + cuántas tienen pack persona completo. */
    people: z.object({
      total: z.number().int().nonnegative(),
      ready: z.number().int().nonnegative(),
    }),
    /** Docs empresa/persona con vencimiento en los próximos N días. */
    documentsExpiring: z.object({
      count: z.number().int().nonnegative(),
      withinDays: z.number().int().positive(),
    }),
    /** Permisos activos (autorizados a bordo) + highlight. */
    permits: z.object({
      activeCount: z.number().int().nonnegative(),
      highlight: z
        .object({
          code: z.string(),
          locationName: z.string(),
        })
        .nullable(),
    }),
    /** Bandeja de pendientes E3. */
    pendingItems: z.array(contractorPortalPendingItemSchema),
  })
  .openapi("ContractorPortalSummary");

export const getContractorPortalSummaryRequestSchema = z.object({});

export type ContractorPortalSummaryResponse = z.infer<
  typeof contractorPortalSummaryResponseSchema
>;

/** Params download doc portal. */
export const contractorPortalDocumentIdParamsSchema = z.object({
  documentId: z.uuid(),
});

export const downloadContractorPortalDocumentRequestSchema = z.object({
  params: contractorPortalDocumentIdParamsSchema,
});

/** Body upload doc portal (mismo contrato que HAB interna). */
export const createContractorPortalDocumentBodySchema = z.object({
  documentTypeId: z.uuid(),
  fileName: z
    .string({ error: "Nombre de archivo requerido" })
    .trim()
    .min(1, "Nombre de archivo requerido")
    .max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1, "Archivo requerido"),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const createContractorPortalDocumentRequestSchema = z.object({
  body: createContractorPortalDocumentBodySchema,
});

export type CreateContractorPortalDocumentBody = z.infer<
  typeof createContractorPortalDocumentBodySchema
>;

/** Persona externa de la org (P2 personal). */
export const contractorPersonResponseSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    rut: z.string(),
    fullName: z.string(),
    position: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    emergencyContact: z.string().nullable(),
    active: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ContractorPerson");

/** Query GET /contractors/:id/people. */
export const listContractorPeopleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().trim().optional(),
});

export const listContractorPeopleRequestSchema = z.object({
  params: contractorIdParamsSchema,
  query: listContractorPeopleQuerySchema,
});

export const listContractorPeopleResponseSchema = z
  .object({
    items: z.array(contractorPersonResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListContractorPeopleResponse");

/** Campos create/update de persona. */
const contractorPersonFieldsObjectSchema = z.object({
  rut: chileanRunSchema,
  fullName: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .max(200),
  position: optionalTextSchema,
  email: optionalEmailSchema,
  phone: optionalTextSchema,
  emergencyContact: optionalTextSchema,
  active: z.boolean().optional(),
});

export const createContractorPersonBodySchema =
  contractorPersonFieldsObjectSchema;

export const createContractorPersonRequestSchema = z.object({
  params: contractorIdParamsSchema,
  body: createContractorPersonBodySchema,
});

export const createContractorPersonResponseSchema =
  contractorPersonResponseSchema;

export const contractorPersonIdParamsSchema = z.object({
  id: z.uuid(),
  personId: z.uuid(),
});

export const updateContractorPersonBodySchema =
  contractorPersonFieldsObjectSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
      message: "Enviá al menos un campo para actualizar",
    });

export const updateContractorPersonRequestSchema = z.object({
  params: contractorPersonIdParamsSchema,
  body: updateContractorPersonBodySchema,
});

export const updateContractorPersonResponseSchema =
  contractorPersonResponseSchema;

export const deleteContractorPersonRequestSchema = z.object({
  params: contractorPersonIdParamsSchema,
});

export const deleteContractorPersonResponseSchema =
  contractorPersonResponseSchema;

export type ContractorPersonResponse = z.infer<
  typeof contractorPersonResponseSchema
>;
export type ListContractorPeopleQuery = z.infer<
  typeof listContractorPeopleQuerySchema
>;
export type CreateContractorPersonBody = z.infer<
  typeof createContractorPersonBodySchema
>;
export type UpdateContractorPersonBody = z.infer<
  typeof updateContractorPersonBodySchema
>;

/** Progreso de docs pack person en el listado portal (E5). */
export const contractorPortalPersonDocumentsSummarySchema = z.object({
  /** Tipos del pack con archivo (cualquier estado salvo replaced). */
  uploaded: z.number().int().nonnegative(),
  required: z.number().int().nonnegative(),
  observed: z.number().int().nonnegative(),
  /** Tipos del pack validados y vigentes (para operar / asignar a PT). */
  validated: z.number().int().nonnegative(),
});

/** Persona del portal con resumen de documentos de la HAB vigente. */
export const contractorPortalPersonResponseSchema =
  contractorPersonResponseSchema
    .extend({
      documents: contractorPortalPersonDocumentsSummarySchema,
    })
    .openapi("ContractorPortalPerson");

/** Query GET /contractors/me/people (sin params de org). */
export const listMyContractorPeopleRequestSchema = z.object({
  query: listContractorPeopleQuerySchema,
});

export const listMyContractorPeopleResponseSchema = z
  .object({
    items: z.array(contractorPortalPersonResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListMyContractorPeopleResponse");

/** POST /contractors/me/people */
export const createMyContractorPersonRequestSchema = z.object({
  body: createContractorPersonBodySchema,
});

/** Params persona del portal. */
export const myContractorPersonIdParamsSchema = z.object({
  personId: z.uuid(),
});

export const updateMyContractorPersonRequestSchema = z.object({
  params: myContractorPersonIdParamsSchema,
  body: updateContractorPersonBodySchema,
});

export const deleteMyContractorPersonRequestSchema = z.object({
  params: myContractorPersonIdParamsSchema,
});

/** Params docs de persona en portal. */
export const myContractorPersonDocumentIdParamsSchema = z.object({
  personId: z.uuid(),
  documentId: z.uuid(),
});

export const listMyContractorPersonDocumentsRequestSchema = z.object({
  params: myContractorPersonIdParamsSchema,
});

export const createMyContractorPersonDocumentRequestSchema = z.object({
  params: myContractorPersonIdParamsSchema,
  body: createContractorPortalDocumentBodySchema,
});

export const downloadMyContractorPersonDocumentRequestSchema = z.object({
  params: myContractorPersonDocumentIdParamsSchema,
});

export type ContractorPortalPersonResponse = z.infer<
  typeof contractorPortalPersonResponseSchema
>;

/**
 * PATCH /contractors/me — antecedentes del portal (E19).
 * No permite cambiar RUT, rol, business ni active.
 */
export const updateMyContractorOrganizationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    specialty: z.string().trim().max(200).nullable().optional(),
    contactName: z.string().trim().max(200).nullable().optional(),
    contactEmail: z
      .union([z.string().email("Email inválido"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    contactPhone: z.string().trim().max(50).nullable().optional(),
    legalRepresentative: z.string().trim().max(200).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    mutual: z.string().trim().max(200).nullable().optional(),
    supervisorName: z.string().trim().max(200).nullable().optional(),
    supervisorEmail: z
      .union([z.string().email("Email inválido"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    prevencionistName: z.string().trim().max(200).nullable().optional(),
    prevencionistEmail: z
      .union([z.string().email("Email inválido"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    subcontractors: z.string().trim().max(500).nullable().optional(),
    workDescription: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Enviá al menos un campo para actualizar",
  });

export const updateMyContractorOrganizationRequestSchema = z.object({
  body: updateMyContractorOrganizationBodySchema,
});

export type UpdateMyContractorOrganizationBody = z.infer<
  typeof updateMyContractorOrganizationBodySchema
>;
