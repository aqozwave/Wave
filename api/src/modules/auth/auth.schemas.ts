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

export type LoginBody = z.infer<typeof loginBodySchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
