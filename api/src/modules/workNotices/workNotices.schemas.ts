import { z } from "../../lib/zod.js";

/** Estados del aviso (aún no es el ciclo del PT). */
export const workNoticeStatusSchema = z.enum([
  "pending",
  "linked",
  "cancelled",
]);

/** Org resumida en el aviso + estado HAB más reciente (solo lectura). */
export const workNoticeOrganizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    rut: z.string(),
    /** Null si la org no tiene HAB. */
    latestAccreditationStatus: z
      .enum([
        "invited",
        "pending",
        "in_review",
        "observed",
        "approved",
        "rejected",
      ])
      .nullable(),
  })
  .openapi("WorkNoticeOrganization");

/** Tipo de permiso resumido. */
export const workNoticePermitTypeSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
  })
  .openapi("WorkNoticePermitType");

/** Nave / lugar resumido. */
export const workNoticeLocationSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
  })
  .openapi("WorkNoticeLocation");

/** Quién creó el aviso. */
export const workNoticeCreatedBySchema = z
  .object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
  })
  .nullable()
  .openapi("WorkNoticeCreatedBy");

/** Área solicitante (acumulador; copia al crear). */
export const workNoticeRequestingAreaSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
  })
  .openapi("WorkNoticeRequestingArea");

/** Aviso de trabajo (AT1 / AT2). */
export const workNoticeResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    code: z.string(),
    organizationId: z.uuid(),
    organization: workNoticeOrganizationSchema,
    permitTypeId: z.uuid(),
    permitType: workNoticePermitTypeSchema,
    locationId: z.uuid(),
    location: workNoticeLocationSchema,
    /** Área del usuario al crear (KPI / filtro por área). */
    requestingAreaId: z.uuid(),
    requestingArea: workNoticeRequestingAreaSchema,
    /** Fecha tentativa YYYY-MM-DD. */
    tentativeDate: z.string(),
    estimatedDurationDays: z.number().int().positive().nullable(),
    description: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    notifyByEmail: z.boolean(),
    status: workNoticeStatusSchema,
    /** PT creado desde este aviso, si existe. */
    workPermit: z
      .object({
        id: z.uuid(),
        code: z.string(),
        status: z.string(),
      })
      .nullable(),
    createdById: z.uuid().nullable(),
    createdBy: workNoticeCreatedBySchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("WorkNotice");

/** Query GET /work-notices. */
export const listWorkNoticesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  status: workNoticeStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export const listWorkNoticesRequestSchema = z.object({
  query: listWorkNoticesQuerySchema,
});

export const listWorkNoticesResponseSchema = z
  .object({
    items: z.array(workNoticeResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListWorkNoticesResponse");

/**
 * Body POST /work-notices (AT2).
 * Org ya debe existir; duración en días es opcional.
 */
export const createWorkNoticeBodySchema = z.object({
  organizationId: z.uuid(),
  permitTypeId: z.uuid(),
  locationId: z.uuid(),
  /** Día ISO (YYYY-MM-DD o datetime); se normaliza a date. */
  tentativeDate: z.string().min(1, "Fecha tentativa es requerida"),
  estimatedDurationDays: z.number().int().positive().max(365).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  /** Vacío se trata como null en el service. */
  contactEmail: z.string().trim().toLowerCase().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  notifyByEmail: z.boolean().optional(),
});

export const createWorkNoticeRequestSchema = z.object({
  body: createWorkNoticeBodySchema,
});

export const createWorkNoticeResponseSchema = workNoticeResponseSchema;

export const getWorkNoticeRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const getWorkNoticeResponseSchema = workNoticeResponseSchema;

/** DELETE /work-notices/:id — soft-delete (permiso deactivate). */
export const deleteWorkNoticeRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const deleteWorkNoticeResponseSchema = workNoticeResponseSchema;

export type WorkNoticeResponse = z.infer<typeof workNoticeResponseSchema>;
export type ListWorkNoticesQuery = z.infer<typeof listWorkNoticesQuerySchema>;
export type CreateWorkNoticeBody = z.infer<typeof createWorkNoticeBodySchema>;
