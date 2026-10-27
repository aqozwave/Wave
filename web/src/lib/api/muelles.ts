import { ApiError, type ApiErrorBody } from "./auth";

/** Muelle tal como lo responde la API. */
export type Muelle = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  portName: string;
  businessId: string;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListMuellesResult = {
  items: Muelle[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type MuelleWriteBody = {
  name?: string;
  portName?: string;
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

/** GET /api/v1/muelles */
export async function listMuellesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; portName?: string },
): Promise<ListMuellesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.portName) params.set("portName", filters.portName);
  const res = await fetch(`/api/v1/muelles?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListMuellesResult;
}

/** POST /api/v1/muelles */
export async function createMuelleRequest(
  accessToken: string,
  data: MuelleWriteBody,
): Promise<Muelle> {
  const res = await fetch("/api/v1/muelles", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Muelle;
}

/** PATCH /api/v1/muelles/:id */
export async function updateMuelleRequest(
  accessToken: string,
  id: string,
  data: MuelleWriteBody,
): Promise<Muelle> {
  const res = await fetch(`/api/v1/muelles/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Muelle;
}

/** DELETE /api/v1/muelles/:id (soft). */
export async function deleteMuelleRequest(
  accessToken: string,
  id: string,
): Promise<Muelle> {
  const res = await fetch(`/api/v1/muelles/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Muelle;
}
