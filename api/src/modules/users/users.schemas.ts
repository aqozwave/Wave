import { strongPasswordSchema } from "../../lib/passwordPolicy.js";
import { chileanRunSchema } from "../../lib/rut.js";
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
    /** Ruta pública relativa (/uploads/…) o null. */
    photoProfile: z.string().nullable(),
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
    /** Acceso con vencimiento (ISO); null = sin límite. */
    accessExpiresAt: z.string().datetime().nullable(),
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

/** Body POST /users — alta admin (envía enlace para elegir contraseña y confirmar). */
export const createUserBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: strongPasswordSchema,
  username: z
    .string()
    .trim()
    .min(3)
    .transform((value) => value.toLowerCase()),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  run: chileanRunSchema,
  /** Obligatorio para superadmin si el rol no es superadmin. */
  businessId: z.uuid().nullable().optional(),
  roleId: z.uuid().nullable().optional(),
  locationId: z.uuid().nullable().optional(),
  areaId: z.uuid().nullable().optional(),
  state: z.boolean().optional(),
  /** ISO datetime o null; útiles para externos temporales. */
  accessExpiresAt: z.string().datetime().nullable().optional(),
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
    password: strongPasswordSchema.optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .transform((value) => value.toLowerCase())
      .optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    run: chileanRunSchema.optional(),
    businessId: z.uuid().nullable().optional(),
    roleId: z.uuid().nullable().optional(),
    locationId: z.uuid().nullable().optional(),
    areaId: z.uuid().nullable().optional(),
    state: z.boolean().optional(),
    confirmed: z.boolean().optional(),
    accessExpiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateUserRequestSchema = z.object({
  params: userIdParamsSchema,
  body: updateUserBodySchema,
});

/**
 * Body JSON con foto en base64 (sin multer).
 * contentBase64: raw o data-URL (data:…;base64,…).
 */
export const uploadUserPhotoBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  contentBase64: z.string().min(1),
});

export const uploadUserPhotoRequestSchema = z.object({
  params: userIdParamsSchema,
  body: uploadUserPhotoBodySchema,
});

export const deleteUserPhotoRequestSchema = z.object({
  params: userIdParamsSchema,
});

export const createUserResponseSchema = userAdminResponseSchema;
export const getUserResponseSchema = userAdminResponseSchema;
export const updateUserResponseSchema = userAdminResponseSchema;
export const deleteUserResponseSchema = userAdminResponseSchema;
export const unlockUserResponseSchema = userAdminResponseSchema;
export const uploadUserPhotoResponseSchema = userAdminResponseSchema;
export const deleteUserPhotoResponseSchema = userAdminResponseSchema;

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserAdminResponse = z.infer<typeof userAdminResponseSchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UploadUserPhotoBody = z.infer<typeof uploadUserPhotoBodySchema>;
