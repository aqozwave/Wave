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

export type LoginSuccess = {
  user: AuthUser;
  accessToken: string;
};

export type ApiErrorBody = {
  code: string;
  message: string;
};

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
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.code ?? "request_failed",
      err?.message ?? `HTTP ${res.status}`,
    );
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
