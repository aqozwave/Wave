import { z } from "../../lib/zod.js";

/** Asignación muelle (con nombre para UI). */
export const crewMemberMuelleResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    crewMemberId: z.uuid(),
    muelleId: z.uuid(),
    muelleName: z.string(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberMuelle");

/** Asignación travesía (con nombre para UI). */
export const crewMemberTravesiaResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    crewMemberId: z.uuid(),
    travesiaId: z.uuid(),
    travesiaName: z.string(),
    requiredPassages: z.number().int(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CrewMemberTravesia");

export const listCrewMemberMuellesResponseSchema = z
  .object({
    items: z.array(crewMemberMuelleResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListCrewMemberMuellesResponse");

export const listCrewMemberTravesiasResponseSchema = z
  .object({
    items: z.array(crewMemberTravesiaResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListCrewMemberTravesiasResponse");

export const crewMemberIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listCrewMemberMuellesRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

export const listCrewMemberTravesiasRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
});

export const createCrewMemberMuelleBodySchema = z.object({
  muelleId: z.uuid(),
});

export const createCrewMemberMuelleRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberMuelleBodySchema,
});

export const createCrewMemberTravesiaBodySchema = z.object({
  travesiaId: z.uuid(),
});

export const createCrewMemberTravesiaRequestSchema = z.object({
  params: crewMemberIdParamsSchema,
  body: createCrewMemberTravesiaBodySchema,
});

export const assignmentIdParamsSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
});

export const deleteCrewMemberMuelleRequestSchema = z.object({
  params: assignmentIdParamsSchema,
});

export const deleteCrewMemberTravesiaRequestSchema = z.object({
  params: assignmentIdParamsSchema,
});

export const createCrewMemberMuelleResponseSchema =
  crewMemberMuelleResponseSchema;
export const deleteCrewMemberMuelleResponseSchema =
  crewMemberMuelleResponseSchema;
export const createCrewMemberTravesiaResponseSchema =
  crewMemberTravesiaResponseSchema;
export const deleteCrewMemberTravesiaResponseSchema =
  crewMemberTravesiaResponseSchema;

export type CreateCrewMemberMuelleBody = z.infer<
  typeof createCrewMemberMuelleBodySchema
>;
export type CreateCrewMemberTravesiaBody = z.infer<
  typeof createCrewMemberTravesiaBodySchema
>;
export type CrewMemberMuelleResponse = z.infer<
  typeof crewMemberMuelleResponseSchema
>;
export type CrewMemberTravesiaResponse = z.infer<
  typeof crewMemberTravesiaResponseSchema
>;
