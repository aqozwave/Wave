import { ApiError, type ApiErrorBody } from "./auth";

/** Entrada de permiso resource + actions. */
export type PermissionEntry = {
  resource: string;
  actions: string[];
};

/** Rol tal como lo responde la API. */
export type Role = {
  id: string;
  legacyMongoId: string | null;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  dataScope: string;
  permissions: PermissionEntry[];
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Catálogo UI de módulos / checks. */
export type PermissionCatalog = {
  actions: string[];
  scopes: string[];
  catalog: Array<{
    module: string;
    items: Array<{
      resource: string;
      label: string;
      actions: string[];
      hint?: string;
    }>;
  }>;
};

/** Body create / patch. */
export type RoleWriteBody = {
  key?: string;
  name?: string;
  description?: string;
  dataScope?: string;
  permissions?: PermissionEntry[];
  state?: boolean;
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

/** GET /api/v1/roles */
export async function listRolesRequest(
  accessToken: string,
  includeInactive = true,
): Promise<{ items: Role[]; total: number }> {
  const params = new URLSearchParams({
    includeInactive: includeInactive ? "true" : "false",
  });
  const res = await fetch(`/api/v1/roles?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: Role[]; total: number };
}

/** GET /api/v1/roles/catalog */
export async function getPermissionCatalogRequest(
  accessToken: string,
): Promise<PermissionCatalog> {
  const res = await fetch("/api/v1/roles/catalog", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as PermissionCatalog;
}

/** GET /api/v1/roles/:id */
export async function getRoleRequest(
  accessToken: string,
  id: string,
): Promise<Role> {
  const res = await fetch(`/api/v1/roles/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Role;
}

/** POST /api/v1/roles */
export async function createRoleRequest(
  accessToken: string,
  data: RoleWriteBody,
): Promise<Role> {
  const res = await fetch("/api/v1/roles", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Role;
}

/** PATCH /api/v1/roles/:id */
export async function updateRoleRequest(
  accessToken: string,
  id: string,
  data: RoleWriteBody,
): Promise<Role> {
  const res = await fetch(`/api/v1/roles/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Role;
}

/** DELETE /api/v1/roles/:id */
export async function deleteRoleRequest(
  accessToken: string,
  id: string,
): Promise<Role> {
  const res = await fetch(`/api/v1/roles/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Role;
}
