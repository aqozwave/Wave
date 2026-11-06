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

export type WorkPermitResponse = z.infer<typeof workPermitResponseSchema>;
export type ListWorkPermitsQuery = z.infer<typeof listWorkPermitsQuerySchema>;
export type CreateWorkPermitBody = z.infer<typeof createWorkPermitBodySchema>;
