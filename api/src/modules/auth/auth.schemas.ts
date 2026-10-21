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

/**
 * Login con MFA activo: aún no hay tokens; el cliente pide verify-mfa.
 */
export const mfaChallengeResponseSchema = z
  .object({
    mfaRequired: z.literal(true),
    challengeId: z.uuid(),
    expiresInSeconds: z.number().int().positive(),
    emailMasked: z.string(),
  })
  .openapi("MfaChallengeResponse");

/** Body de verificación MFA. */
export const verifyMfaBodySchema = z.object({
  challengeId: z.uuid(),
  // Exactamente 6 dígitos.
  code: z.string().regex(/^\d{6}$/),
});

export const verifyMfaRequestSchema = z.object({
  body: verifyMfaBodySchema,
});

/** Body de reenvío MFA. */
export const resendMfaBodySchema = z.object({
  challengeId: z.uuid(),
});

export const resendMfaRequestSchema = z.object({
  body: resendMfaBodySchema,
});

export const resendMfaResponseSchema = z
  .object({
    message: z.string(),
    /** Nuevo challengeId (el anterior se invalida al reenviar). */
    challengeId: z.uuid(),
    expiresInSeconds: z.number().int().positive(),
    emailMasked: z.string(),
  })
  .openapi("ResendMfaResponse");

export type MfaChallengeResponse = z.infer<typeof mfaChallengeResponseSchema>;
export type VerifyMfaBody = z.infer<typeof verifyMfaBodySchema>;
export type ResendMfaBody = z.infer<typeof resendMfaBodySchema>;
export type ResendMfaResponse = z.infer<typeof resendMfaResponseSchema>;

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

/**
 * Alta de usuario por superadmin (Sección 1).
 * Sin businessId aún (Empresas = Sección 2). confirmed queda false.
 */
export const registerBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  // Mínimo 8: misma barra que usaremos en reset; sin complejidad extra aún.
  password: z.string().min(8),
  username: z
    .string()
    .trim()
    .min(3)
    .transform((value) => value.toLowerCase()),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  // RUN como texto; validación dígito verificador entra con reglas de negocio.
  run: z.string().trim().min(3),
});

export const registerRequestSchema = z.object({
  body: registerBodySchema,
});

/** Respuesta de register: usuario sin tokens (debe confirmar correo). */
export const registerResponseSchema = z
  .object({
    user: authUserSchema,
    message: z.string(),
  })
  .openapi("RegisterResponse");

export type LoginBody = z.infer<typeof loginBodySchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

/** Body de confirmación de correo (token en claro del enlace). */
export const confirmEmailBodySchema = z.object({
  token: z.string().min(1),
});

export const confirmEmailRequestSchema = z.object({
  body: confirmEmailBodySchema,
});

export const confirmEmailResponseSchema = z
  .object({
    message: z.string(),
    user: authUserSchema,
  })
  .openapi("ConfirmEmailResponse");

export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
export type ConfirmEmailResponse = z.infer<typeof confirmEmailResponseSchema>;

/** Body de reenvío de confirmación (público; anti-enumeración). */
export const resendConfirmationBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resendConfirmationRequestSchema = z.object({
  body: resendConfirmationBodySchema,
});

export const resendConfirmationResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("ResendConfirmationResponse");

export type ResendConfirmationBody = z.infer<
  typeof resendConfirmationBodySchema
>;
export type ResendConfirmationResponse = z.infer<
  typeof resendConfirmationResponseSchema
>;

/** Body de “olvidé mi contraseña” (público; anti-enumeración). */
export const forgotPasswordBodySchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const forgotPasswordRequestSchema = z.object({
  body: forgotPasswordBodySchema,
});

export const forgotPasswordResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("ForgotPasswordResponse");

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ForgotPasswordResponse = z.infer<
  typeof forgotPasswordResponseSchema
>;

/** Body de reset: token del mail + nueva contraseña. */
export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  // Misma barra mínima que register.
  password: z.string().min(8),
});

export const resetPasswordRequestSchema = z.object({
  body: resetPasswordBodySchema,
});

export const resetPasswordResponseSchema = z
  .object({
    message: z.string(),
    user: authUserSchema,
  })
  .openapi("ResetPasswordResponse");

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
