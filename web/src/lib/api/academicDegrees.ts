import { ApiError, type ApiErrorBody } from "./auth";

/** Título académico / marítimo tal como lo responde la API. */
export type AcademicDegree = {
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
export type ListAcademicDegreesResult = {
  items: AcademicDegree[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type AcademicDegreeWriteBody = {
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

/** GET /api/v1/academic-degrees */
export async function listAcademicDegreesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string },
): Promise<ListAcademicDegreesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  const res = await fetch(`/api/v1/academic-degrees?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAcademicDegreesResult;
}

/** POST /api/v1/academic-degrees */
export async function createAcademicDegreeRequest(
  accessToken: string,
  data: AcademicDegreeWriteBody,
): Promise<AcademicDegree> {
  const res = await fetch("/api/v1/academic-degrees", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AcademicDegree;
}

/** PATCH /api/v1/academic-degrees/:id */
export async function updateAcademicDegreeRequest(
  accessToken: string,
  id: string,
  data: AcademicDegreeWriteBody,
): Promise<AcademicDegree> {
  const res = await fetch(`/api/v1/academic-degrees/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AcademicDegree;
}

/** DELETE /api/v1/academic-degrees/:id (soft). */
export async function deleteAcademicDegreeRequest(
  accessToken: string,
  id: string,
): Promise<AcademicDegree> {
  const res = await fetch(`/api/v1/academic-degrees/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as AcademicDegree;
}
