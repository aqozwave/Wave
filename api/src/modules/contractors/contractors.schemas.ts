import { chileanRunSchema } from "../../lib/rut.js";
import { z } from "../../lib/zod.js";

/** Relación laboral con el tenant (permanente / ocasional). */
export const contractorRoleSchema = z.enum(["permanent", "occasional"]);

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

export type ContractorOrganizationResponse = z.infer<
  typeof contractorOrganizationResponseSchema
>;
export type ListContractorsQuery = z.infer<typeof listContractorsQuerySchema>;
export type CreateContractorBody = z.infer<typeof createContractorBodySchema>;
export type UpdateContractorBody = z.infer<typeof updateContractorBodySchema>;
