import { ApiError, type ApiErrorBody } from "./auth";

/** Área tal como la responde la API. */
export type Area = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  locationId: string;
  businessId: string;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListAreasResult = {
  items: Area[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type AreaWriteBody = {
  name?: string;
  locationId?: string;
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

/** GET /api/v1/areas */
export async function listAreasRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; locationId?: string },
): Promise<ListAreasResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.locationId) params.set("locationId", filters.locationId);
  const res = await fetch(`/api/v1/areas?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAreasResult;
}

/** POST /api/v1/areas */
export async function createAreaRequest(
  accessToken: string,
  data: AreaWriteBody,
): Promise<Area> {
  const res = await fetch("/api/v1/areas", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Area;
}

/** PATCH /api/v1/areas/:id */
export async function updateAreaRequest(
  accessToken: string,
  id: string,
  data: AreaWriteBody,
): Promise<Area> {
  const res = await fetch(`/api/v1/areas/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Area;
}

/** DELETE /api/v1/areas/:id (soft). */
export async function deleteAreaRequest(
  accessToken: string,
  id: string,
): Promise<Area> {
  const res = await fetch(`/api/v1/areas/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Area;
}
