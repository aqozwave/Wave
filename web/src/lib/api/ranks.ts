import { ApiError, type ApiErrorBody } from "./auth";

/** Rango / cargo tal como lo responde la API. */
export type Rank = {
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
export type ListRanksResult = {
  items: Rank[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type RankWriteBody = {
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

/** GET /api/v1/ranks */
export async function listRanksRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string },
): Promise<ListRanksResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  const res = await fetch(`/api/v1/ranks?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListRanksResult;
}

/** POST /api/v1/ranks */
export async function createRankRequest(
  accessToken: string,
  data: RankWriteBody,
): Promise<Rank> {
  const res = await fetch("/api/v1/ranks", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Rank;
}

/** PATCH /api/v1/ranks/:id */
export async function updateRankRequest(
  accessToken: string,
  id: string,
  data: RankWriteBody,
): Promise<Rank> {
  const res = await fetch(`/api/v1/ranks/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Rank;
}

/** DELETE /api/v1/ranks/:id (soft). */
export async function deleteRankRequest(
  accessToken: string,
  id: string,
): Promise<Rank> {
  const res = await fetch(`/api/v1/ranks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Rank;
}
