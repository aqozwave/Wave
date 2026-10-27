import { z } from "../../lib/zod.js";

/** Rol embebido en respuestas de usuario (selector / tabla). */
export const userRoleSummarySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
});

/** Empresa embebida (nombre en tabla). */
export const userBusinessSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/** Usuario de administración (sin passwordHash). */
export const userAdminResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    run: z.string(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    pendingEmail: z.string().nullable(),
    internalRol: z.string(),
    roleId: z.uuid().nullable(),
    role: userRoleSummarySchema.nullable(),
    businessId: z.uuid().nullable(),
    business: userBusinessSummarySchema.nullable(),
    locationId: z.uuid().nullable(),
    areaId: z.uuid().nullable(),
    state: z.boolean(),
    confirmed: z.boolean(),
    loginAttempts: z.number().int().nonnegative(),
    lockUntil: z.string().datetime().nullable(),
    lastLoginAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("UserAdmin");

/** Query listado: página, búsqueda y filtro de empresa. */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  businessId: z.uuid().optional(),
  /** Si true, incluye state=false (sigue sin borrados). */
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const listUsersRequestSchema = z.object({
  query: listUsersQuerySchema,
});

export const listUsersResponseSchema = z
  .object({
    items: z.array(userAdminResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListUsersResponse");

/** Body POST /users — alta admin (envía correo de confirmación). */
export const createUserBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
  username: z
    .string()
    .trim()
    .min(3)
    .transform((value) => value.toLowerCase()),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  run: z.string().trim().min(3),
  /** Obligatorio para superadmin si el rol no es superadmin. */
  businessId: z.uuid().nullable().optional(),
  roleId: z.uuid().nullable().optional(),
  locationId: z.uuid().nullable().optional(),
  areaId: z.uuid().nullable().optional(),
  state: z.boolean().optional(),
});

export const createUserRequestSchema = z.object({
  body: createUserBodySchema,
});

/** Params `:id` uuid. */
export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getUserRequestSchema = z.object({
  params: userIdParamsSchema,
});

export const deleteUserRequestSchema = z.object({
  params: userIdParamsSchema,
});

export const unlockUserRequestSchema = z.object({
  params: userIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * password opcional (reset admin); email lo pisa el admin directo.
 */
export const updateUserBodySchema = z
  .object({
    email: z.email().trim().toLowerCase().optional(),
    password: z.string().min(8).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .transform((value) => value.toLowerCase())
      .optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    run: z.string().trim().min(3).optional(),
    businessId: z.uuid().nullable().optional(),
    roleId: z.uuid().nullable().optional(),
    locationId: z.uuid().nullable().optional(),
    areaId: z.uuid().nullable().optional(),
    state: z.boolean().optional(),
    confirmed: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateUserRequestSchema = z.object({
  params: userIdParamsSchema,
  body: updateUserBodySchema,
});

export const createUserResponseSchema = userAdminResponseSchema;
export const getUserResponseSchema = userAdminResponseSchema;
export const updateUserResponseSchema = userAdminResponseSchema;
export const deleteUserResponseSchema = userAdminResponseSchema;
export const unlockUserResponseSchema = userAdminResponseSchema;

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserAdminResponse = z.infer<typeof userAdminResponseSchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
