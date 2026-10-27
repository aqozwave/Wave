import { ApiError, type ApiErrorBody } from "./auth";

/** Puerto tal como lo responde la API. */
export type Port = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListPortsResult = {
  items: Port[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type PortWriteBody = {
  name?: string;
  businessId?: string;
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

/** GET /api/v1/ports */
export async function listPortsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string },
): Promise<ListPortsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  const res = await fetch(`/api/v1/ports?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListPortsResult;
}

/** POST /api/v1/ports */
export async function createPortRequest(
  accessToken: string,
  data: PortWriteBody,
): Promise<Port> {
  const res = await fetch("/api/v1/ports", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Port;
}

/** PATCH /api/v1/ports/:id */
export async function updatePortRequest(
  accessToken: string,
  id: string,
  data: PortWriteBody,
): Promise<Port> {
  const res = await fetch(`/api/v1/ports/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Port;
}

/** DELETE /api/v1/ports/:id (soft). */
export async function deletePortRequest(
  accessToken: string,
  id: string,
): Promise<Port> {
  const res = await fetch(`/api/v1/ports/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Port;
}
