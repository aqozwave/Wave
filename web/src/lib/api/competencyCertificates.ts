import { ApiError, type ApiErrorBody } from "./auth";

/** Oficial de nave (API). */
export type OfficerKind = "captain" | "first_pilot";

/** Certificado de competencia tal como lo responde la API. */
export type CompetencyCertificate = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  officerKind: OfficerKind | null;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListCompetencyCertificatesResult = {
  items: CompetencyCertificate[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type CompetencyCertificateWriteBody = {
  name?: string;
  businessId?: string;
  officerKind?: OfficerKind | null;
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

/** GET /api/v1/competency-certificates */
export async function listCompetencyCertificatesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; officerKind?: OfficerKind },
): Promise<ListCompetencyCertificatesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.officerKind) params.set("officerKind", filters.officerKind);
  const res = await fetch(`/api/v1/competency-certificates?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCompetencyCertificatesResult;
}

/** POST /api/v1/competency-certificates */
export async function createCompetencyCertificateRequest(
  accessToken: string,
  data: CompetencyCertificateWriteBody,
): Promise<CompetencyCertificate> {
  const res = await fetch("/api/v1/competency-certificates", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}

/** PATCH /api/v1/competency-certificates/:id */
export async function updateCompetencyCertificateRequest(
  accessToken: string,
  id: string,
  data: CompetencyCertificateWriteBody,
): Promise<CompetencyCertificate> {
  const res = await fetch(`/api/v1/competency-certificates/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}

/** DELETE /api/v1/competency-certificates/:id (soft). */
export async function deleteCompetencyCertificateRequest(
  accessToken: string,
  id: string,
): Promise<CompetencyCertificate> {
  const res = await fetch(`/api/v1/competency-certificates/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}
