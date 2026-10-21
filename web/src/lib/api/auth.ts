/** Perfil público del usuario (sin passwordHash). */
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
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
): Promise<LoginSuccess> {
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
