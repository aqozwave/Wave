import { ApiError, type ApiErrorBody } from "./auth";

/** Travesía tal como la responde la API. */
export type Travesia = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  requiredPassages: number;
  businessId: string;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListTravesiasResult = {
  items: Travesia[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type TravesiaWriteBody = {
  name?: string;
  requiredPassages?: number;
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

/** GET /api/v1/travesias */
export async function listTravesiasRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string },
): Promise<ListTravesiasResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  const res = await fetch(`/api/v1/travesias?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListTravesiasResult;
}

/** POST /api/v1/travesias */
export async function createTravesiaRequest(
  accessToken: string,
  data: TravesiaWriteBody,
): Promise<Travesia> {
  const res = await fetch("/api/v1/travesias", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Travesia;
}

/** PATCH /api/v1/travesias/:id */
export async function updateTravesiaRequest(
  accessToken: string,
  id: string,
  data: TravesiaWriteBody,
): Promise<Travesia> {
  const res = await fetch(`/api/v1/travesias/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Travesia;
}

/** DELETE /api/v1/travesias/:id (soft). */
export async function deleteTravesiaRequest(
  accessToken: string,
  id: string,
): Promise<Travesia> {
  const res = await fetch(`/api/v1/travesias/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Travesia;
}
