import { ApiError, type ApiErrorBody } from "./auth";

/** Tipo de lugar (API). UI: Nave / Oficina / Bodega / Otro. */
export type LocationKind = "vessel" | "office" | "warehouse" | "other";

/** Lugar de trabajo tal como lo responde la API. */
export type Location = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  kind: LocationKind | null;
  businessId: string;
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
export type ListLocationsResult = {
  items: Location[];
  total: number;
  page: number;
  limit: number;
};

/** Body de create / patch. */
export type LocationWriteBody = {
  name?: string;
  businessId?: string;
  kind?: LocationKind | null;
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

/** GET /api/v1/locations */
export async function listLocationsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  businessId?: string,
): Promise<ListLocationsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (businessId) {
    params.set("businessId", businessId);
  }
  const res = await fetch(`/api/v1/locations?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as ListLocationsResult;
}

/** POST /api/v1/locations */
export async function createLocationRequest(
  accessToken: string,
  data: LocationWriteBody,
): Promise<Location> {
  const res = await fetch("/api/v1/locations", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Location;
}

/** PATCH /api/v1/locations/:id */
export async function updateLocationRequest(
  accessToken: string,
  id: string,
  data: LocationWriteBody,
): Promise<Location> {
  const res = await fetch(`/api/v1/locations/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Location;
}

/** DELETE /api/v1/locations/:id (soft). */
export async function deleteLocationRequest(
  accessToken: string,
  id: string,
): Promise<Location> {
  const res = await fetch(`/api/v1/locations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res, body);
  }
  return body as Location;
}
