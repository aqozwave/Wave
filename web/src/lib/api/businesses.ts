import { ApiError, type ApiErrorBody } from "./auth";

/** Empresa tal como la responde la API. */
export type Business = {
  id: string;
  legacyMongoId: string | null;
  rut: string | null;
  name: string;
  giro: string | null;
  country: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListBusinessesResult = {
  items: Business[];
  total: number;
  page: number;
  limit: number;
};

/** Body de create / patch (campos opcionales en patch). */
export type BusinessWriteBody = {
  rut?: string;
  name?: string;
  giro?: string;
  country?: string;
  commune?: string;
  city?: string;
  phone?: string;
  email?: string;
  description?: string;
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

/** Headers Bearer para rutas protegidas. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/businesses */
export async function listBusinessesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
): Promise<ListBusinessesResult> {
  const res = await fetch(
    `/api/v1/businesses?page=${page}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as ListBusinessesResult;
}

/** GET /api/v1/businesses/:id */
export async function getBusinessRequest(
  accessToken: string,
  id: string,
): Promise<Business> {
  const res = await fetch(`/api/v1/businesses/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Business;
}

/** POST /api/v1/businesses */
export async function createBusinessRequest(
  accessToken: string,
  data: BusinessWriteBody,
): Promise<Business> {
  const res = await fetch("/api/v1/businesses", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Business;
}

/** PATCH /api/v1/businesses/:id */
export async function updateBusinessRequest(
  accessToken: string,
  id: string,
  data: BusinessWriteBody,
): Promise<Business> {
  const res = await fetch(`/api/v1/businesses/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Business;
}

/** DELETE /api/v1/businesses/:id (soft). */
export async function deleteBusinessRequest(
  accessToken: string,
  id: string,
): Promise<Business> {
  const res = await fetch(`/api/v1/businesses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Business;
}
