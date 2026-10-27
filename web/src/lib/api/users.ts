import { ApiError, type ApiErrorBody } from "./auth";

/** Rol embebido en usuario admin. */
export type UserRoleSummary = {
  id: string;
  key: string;
  name: string;
};

/** Empresa embebida. */
export type UserBusinessSummary = {
  id: string;
  name: string;
};

/** Usuario de administración (API /users). */
export type AdminUser = {
  id: string;
  legacyMongoId: string | null;
  run: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  pendingEmail: string | null;
  internalRol: string;
  roleId: string | null;
  role: UserRoleSummary | null;
  businessId: string | null;
  business: UserBusinessSummary | null;
  locationId: string | null;
  areaId: string | null;
  state: boolean;
  confirmed: boolean;
  loginAttempts: number;
  lockUntil: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListUsersResult = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

/** Body create. */
export type CreateUserBody = {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  run: string;
  businessId?: string | null;
  roleId?: string | null;
  locationId?: string | null;
  areaId?: string | null;
  state?: boolean;
};

/** Body patch. */
export type UpdateUserBody = {
  email?: string;
  password?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  run?: string;
  businessId?: string | null;
  roleId?: string | null;
  locationId?: string | null;
  areaId?: string | null;
  state?: boolean;
  confirmed?: boolean;
};

/** Query de listado. */
export type ListUsersQuery = {
  page?: number;
  limit?: number;
  search?: string;
  businessId?: string;
  includeInactive?: boolean;
};

/** Parsea error estándar Wave. */
function toApiError(res: Response, body: unknown): ApiError {
  const err = body as ApiErrorBody | null;
  return new ApiError(
    res.status,
    err?.code ?? "request_failed",
    err?.message ?? `HTTP ${res.status}`,
  );
}

/** Headers Bearer. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/users */
export async function listUsersRequest(
  accessToken: string,
  query: ListUsersQuery = {},
): Promise<ListUsersResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 50));
  params.set("includeInactive", query.includeInactive === false ? "false" : "true");
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.businessId) params.set("businessId", query.businessId);

  const res = await fetch(`/api/v1/users?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListUsersResult;
}

/** GET /api/v1/users/:id */
export async function getUserRequest(
  accessToken: string,
  id: string,
): Promise<AdminUser> {
  const res = await fetch(`/api/v1/users/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AdminUser;
}

/** POST /api/v1/users */
export async function createUserRequest(
  accessToken: string,
  data: CreateUserBody,
): Promise<AdminUser> {
  const res = await fetch("/api/v1/users", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AdminUser;
}

/** PATCH /api/v1/users/:id */
export async function updateUserRequest(
  accessToken: string,
  id: string,
  data: UpdateUserBody,
): Promise<AdminUser> {
  const res = await fetch(`/api/v1/users/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AdminUser;
}

/** DELETE /api/v1/users/:id */
export async function deleteUserRequest(
  accessToken: string,
  id: string,
): Promise<AdminUser> {
  const res = await fetch(`/api/v1/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AdminUser;
}

/** POST /api/v1/users/:id/unlock */
export async function unlockUserRequest(
  accessToken: string,
  id: string,
): Promise<AdminUser> {
  const res = await fetch(`/api/v1/users/${id}/unlock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AdminUser;
}
