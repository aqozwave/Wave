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
