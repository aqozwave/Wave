import { z } from "../../lib/zod.js";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  ROLE_DATA_SCOPES,
} from "../../lib/permissions.js";

/** Una entrada resource + actions. */
export const permissionEntrySchema = z.object({
  resource: z.enum(PERMISSION_RESOURCES as [string, ...string[]]),
  actions: z
    .array(z.enum(PERMISSION_ACTIONS as [string, ...string[]]))
    .min(1, "Cada permiso requiere al menos una acción"),
});

/** Un rol en respuestas de API. */
export const roleResponseSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    key: z.string(),
    name: z.string(),
    description: z.string(),
    isSystem: z.boolean(),
    dataScope: z.enum(ROLE_DATA_SCOPES as [string, ...string[]]),
    permissions: z.array(permissionEntrySchema),
    state: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Role");

/** Query listado. */
export const listRolesQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const listRolesRequestSchema = z.object({
  query: listRolesQuerySchema,
});

export const listRolesResponseSchema = z
  .object({
    items: z.array(roleResponseSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListRolesResponse");

/** Catálogo de permisos para la UI de checks. */
export const permissionCatalogResponseSchema = z
  .object({
    actions: z.array(z.string()),
    scopes: z.array(z.string()),
    catalog: z.array(
      z.object({
        module: z.string(),
        items: z.array(
          z.object({
            resource: z.string(),
            label: z.string(),
            actions: z.array(z.string()),
            hint: z.string().optional(),
          }),
        ),
      }),
    ),
  })
  .openapi("PermissionCatalog");

/** Body POST /roles. */
export const createRoleBodySchema = z.object({
  /** Si se omite, se deriva del nombre. */
  key: z.string().trim().min(1).max(64).optional(),
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido")
    .max(80),
  description: z.string().trim().max(300).optional(),
  dataScope: z.enum(ROLE_DATA_SCOPES as [string, ...string[]], {
    error: "Alcance de datos es requerido",
  }),
  permissions: z.array(permissionEntrySchema).default([]),
  state: z.boolean().optional(),
});

export const createRoleRequestSchema = z.object({
  body: createRoleBodySchema,
});

export const createRoleResponseSchema = roleResponseSchema;

/** Params :id. */
export const roleIdParamsSchema = z.object({
  id: z.uuid(),
});

export const getRoleRequestSchema = z.object({
  params: roleIdParamsSchema,
});

export const deleteRoleRequestSchema = z.object({
  params: roleIdParamsSchema,
});

/**
 * Body PATCH: parcial.
 * key e isSystem no se cambian; dataScope de sistema tampoco (service).
 */
export const updateRoleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    dataScope: z.enum(ROLE_DATA_SCOPES as [string, ...string[]]).optional(),
    permissions: z.array(permissionEntrySchema).optional(),
    state: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateRoleRequestSchema = z.object({
  params: roleIdParamsSchema,
  body: updateRoleBodySchema,
});

export const updateRoleResponseSchema = roleResponseSchema;
export const deleteRoleResponseSchema = roleResponseSchema;
export const getRoleResponseSchema = roleResponseSchema;

export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;
export type RoleResponse = z.infer<typeof roleResponseSchema>;
export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;
export type PermissionEntry = z.infer<typeof permissionEntrySchema>;
