import { z } from "../../lib/zod.js";

export const loginBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export const loginRequestSchema = z.object({
  body: loginBodySchema,
});

export const authUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    internalRol: z.string(),
    roleId: z.uuid().nullable(),
    businessId: z.uuid().nullable(),
    confirmed: z.boolean(),
    state: z.boolean(),
  })
  .openapi("AuthUser");

export const loginResponseSchema = z
  .object({
    user: authUserSchema,
    accessToken: z.string(),
    // Solo iOS (X-Client: ios). Web lo recibe en cookie HttpOnly.
    refreshToken: z.string().optional(),
  })
  .openapi("LoginResponse");

/** Respuesta de GET /me: perfil del usuario autenticado. */
export const meResponseSchema = z
  .object({
    user: authUserSchema,
  })
  .openapi("MeResponse");

/**
 * Body de refresh: iOS manda refreshToken; web lo omite (viene en cookie).
 */
export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const refreshRequestSchema = z.object({
  body: refreshBodySchema.default({}),
});

/** Misma forma que login: web sin refresh en body; iOS con refresh. */
export const refreshResponseSchema = z
  .object({
    user: authUserSchema,
    accessToken: z.string(),
    refreshToken: z.string().optional(),
  })
  .openapi("RefreshResponse");

/** Confirmación de logout (cookie borrada + tokenVersion++). */
export const logoutResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("LogoutResponse");

export type LoginBody = z.infer<typeof loginBodySchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
