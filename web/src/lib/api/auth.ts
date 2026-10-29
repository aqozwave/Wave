/** Perfil público del usuario (sin passwordHash). */
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  /** Ruta relativa /uploads/… o null. */
  photoProfile: string | null;
  internalRol: string;
  roleId: string | null;
  businessId: string | null;
  confirmed: boolean;
  state: boolean;
};

/** Respuesta de POST /login (web: sin refreshToken en body). */
export type LoginSuccess = {
  user: AuthUser;
  accessToken: string;
};

/** Login con MFA: aún no hay tokens. */
export type MfaChallenge = {
  mfaRequired: true;
  challengeId: string;
  expiresInSeconds: number;
  emailMasked: string;
};

/** Resultado de login: sesión completa o challenge MFA. */
export type LoginResult = LoginSuccess | MfaChallenge;

/** True si la respuesta es challenge MFA. */
export function isMfaChallenge(result: LoginResult): result is MfaChallenge {
  return "mfaRequired" in result && result.mfaRequired === true;
}

/** Respuesta de GET /me. */
export type MeSuccess = {
  user: AuthUser;
};

/** Cuerpo de error estándar de la API Wave. */
export type ApiErrorBody = {
  code: string;
  message: string;
};

/** Error HTTP tipado para que la UI muestre `message` / `code`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Parsea JSON de error o arma uno genérico si el body no sirve. */
function toApiError(res: Response, body: unknown): ApiError {
  const err = body as ApiErrorBody | null;
  return new ApiError(
    res.status,
    err?.code ?? "request_failed",
    err?.message ?? `HTTP ${res.status}`,
  );
}

/** POST /api/v1/auth/login con X-Client web (refresh en cookie). */
export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client": "web",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(res, body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "mfaRequired" in body &&
    (body as MfaChallenge).mfaRequired === true &&
    typeof (body as MfaChallenge).challengeId === "string"
  ) {
    return body as MfaChallenge;
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("accessToken" in body) ||
    typeof (body as LoginSuccess).accessToken !== "string" ||
    !("user" in body)
  ) {
    throw new ApiError(500, "invalid_response", "Respuesta inválida del login");
  }

  return body as LoginSuccess;
}

/** POST /auth/verify-mfa — completa sesión tras el código. */
export async function verifyMfaRequest(
  challengeId: string,
  code: string,
): Promise<LoginSuccess> {
  const res = await fetch("/api/v1/auth/verify-mfa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client": "web",
    },
    credentials: "include",
    body: JSON.stringify({ challengeId, code }),
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(res, body);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("accessToken" in body) ||
    typeof (body as LoginSuccess).accessToken !== "string" ||
    !("user" in body)
  ) {
    throw new ApiError(500, "invalid_response", "Respuesta inválida de verify-mfa");
  }

  return body as LoginSuccess;
}

/** POST /auth/resend-mfa — nuevo código + nuevo challengeId. */
export async function resendMfaRequest(
  challengeId: string,
): Promise<MfaChallenge & { message: string }> {
  const res = await fetch("/api/v1/auth/resend-mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId }),
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(res, body);
  }

  return body as MfaChallenge & { message: string };
}

/** GET /api/v1/auth/me — valida el Bearer y trae el perfil fresco. */
export async function meRequest(accessToken: string): Promise<MeSuccess> {
  const res = await fetch("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(res, body);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("user" in body) ||
    typeof (body as MeSuccess).user !== "object"
  ) {
    throw new ApiError(500, "invalid_response", "Respuesta inválida de /me");
  }

  return body as MeSuccess;
}

/** Body PATCH /auth/me. */
export type UpdateMeBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

/** Body POST /auth/me/photo. */
export type UploadMyPhotoBody = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

/** PATCH /api/v1/auth/me */
export async function updateMeRequest(
  accessToken: string,
  data: UpdateMeBody,
): Promise<MeSuccess> {
  const res = await fetch("/api/v1/auth/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as MeSuccess;
}

/** POST /api/v1/auth/me/photo */
export async function uploadMyPhotoRequest(
  accessToken: string,
  data: UploadMyPhotoBody,
): Promise<MeSuccess> {
  const res = await fetch("/api/v1/auth/me/photo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as MeSuccess;
}

/** DELETE /api/v1/auth/me/photo */
export async function deleteMyPhotoRequest(
  accessToken: string,
): Promise<MeSuccess> {
  const res = await fetch("/api/v1/auth/me/photo", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as MeSuccess;
}

/**
 * POST /auth/me/password — cambia la clave; renueva access (refresh en cookie).
 * Otras sesiones dejan de valer.
 */
export async function changeMyPasswordRequest(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<LoginSuccess> {
  const res = await fetch("/api/v1/auth/me/password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Client": "web",
    },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  if (
    typeof body !== "object" ||
    body === null ||
    !("accessToken" in body) ||
    typeof (body as LoginSuccess).accessToken !== "string" ||
    !("user" in body)
  ) {
    throw new ApiError(
      500,
      "invalid_response",
      "Respuesta inválida al cambiar contraseña",
    );
  }
  return body as LoginSuccess;
}

/**
 * POST /api/v1/auth/refresh (web): usa cookie HttpOnly; no manda refresh en body.
 * Devuelve nuevo accessToken (+ Set-Cookie con refresh rotado).
 */
export async function refreshRequest(): Promise<LoginSuccess> {
  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client": "web",
    },
    credentials: "include",
    body: "{}",
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw toApiError(res, body);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("accessToken" in body) ||
    typeof (body as LoginSuccess).accessToken !== "string" ||
    !("user" in body)
  ) {
    throw new ApiError(500, "invalid_response", "Respuesta inválida del refresh");
  }

  return body as LoginSuccess;
}

/**
 * POST /api/v1/auth/logout: invalida JWT en servidor y borra cookie refresh.
 * Si falla la red igual conviene limpiar el cliente.
 */
export async function logoutRequest(accessToken: string): Promise<void> {
  const res = await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Client": "web",
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
}

/**
 * POST /auth/clear-session — sin Bearer: revoca cookie refresh y la borra.
 * Usar en confirm-email, reset-password y «Usar otra cuenta».
 */
export async function clearSessionRequest(): Promise<void> {
  const res = await fetch("/api/v1/auth/clear-session", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
}

/** Respuesta genérica con mensaje (forgot / resend). */
export type MessageSuccess = {
  message: string;
};

/** POST /auth/forgot-password — siempre 200 con mensaje fijo. */
export async function forgotPasswordRequest(
  email: string,
): Promise<MessageSuccess> {
  const res = await fetch("/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as MessageSuccess;
}

/** POST /auth/resend-confirmation — siempre 200 con mensaje fijo. */
export async function resendConfirmationRequest(
  email: string,
): Promise<MessageSuccess> {
  const res = await fetch("/api/v1/auth/resend-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as MessageSuccess;
}

/** POST /auth/reset-password — cambia la clave con el token del mail. */
export async function resetPasswordRequest(
  token: string,
  password: string,
): Promise<MessageSuccess> {
  const res = await fetch("/api/v1/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as MessageSuccess;
}

/** POST /auth/confirm-email — activa la cuenta con el token del mail. */
export async function confirmEmailRequest(
  token: string,
): Promise<MessageSuccess> {
  const res = await fetch("/api/v1/auth/confirm-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as MessageSuccess;
}
