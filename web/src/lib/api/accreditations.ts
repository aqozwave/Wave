import { ApiError, type ApiErrorBody } from "./auth";

/** Estados de habilitación. */
export type AccreditationStatus =
  | "invited"
  | "pending"
  | "in_review"
  | "observed"
  | "approved"
  | "rejected";

/** Org resumida en la HAB. */
export type AccreditationOrganization = {
  id: string;
  name: string;
  rut: string;
  businessId: string;
};

/** Habilitación (HAB-NNNN). */
export type ContractorAccreditation = {
  id: string;
  code: string;
  organizationId: string;
  organization: AccreditationOrganization;
  status: AccreditationStatus;
  message: string | null;
  reviewNote: string | null;
  requestedAt: string | null;
  requestedById: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListAccreditationsResult = {
  items: ContractorAccreditation[];
  total: number;
  page: number;
  limit: number;
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

/** Headers Bearer + JSON. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/accreditations */
export async function listAccreditationsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: {
    businessId?: string;
    organizationId?: string;
    status?: AccreditationStatus;
    search?: string;
  },
): Promise<ListAccreditationsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.organizationId) {
    params.set("organizationId", filters.organizationId);
  }
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/v1/accreditations?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAccreditationsResult;
}

/** POST /api/v1/accreditations — solicitar documentación. */
export async function createAccreditationRequest(
  accessToken: string,
  data: {
    organizationId: string;
    dueAt?: string | null;
    message?: string | null;
  },
): Promise<ContractorAccreditation> {
  const res = await fetch("/api/v1/accreditations", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorAccreditation;
}

/** POST …/submit | approve | return | reject */
async function postAccreditationAction(
  accessToken: string,
  id: string,
  action: "submit" | "approve" | "return" | "reject",
  body?: { reviewNote: string },
): Promise<ContractorAccreditation> {
  const res = await fetch(`/api/v1/accreditations/${id}/${action}`, {
    method: "POST",
    headers: body
      ? authHeaders(accessToken)
      : { Authorization: `Bearer ${accessToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, json);
  return json as ContractorAccreditation;
}

/** Enviar a revisión. */
export function submitAccreditationRequest(
  accessToken: string,
  id: string,
): Promise<ContractorAccreditation> {
  return postAccreditationAction(accessToken, id, "submit");
}

/** Aprobar. */
export function approveAccreditationRequest(
  accessToken: string,
  id: string,
): Promise<ContractorAccreditation> {
  return postAccreditationAction(accessToken, id, "approve");
}

/** Devolver con observaciones. */
export function returnAccreditationRequest(
  accessToken: string,
  id: string,
  reviewNote: string,
): Promise<ContractorAccreditation> {
  return postAccreditationAction(accessToken, id, "return", { reviewNote });
}

/** Rechazar. */
export function rejectAccreditationRequest(
  accessToken: string,
  id: string,
  reviewNote: string,
): Promise<ContractorAccreditation> {
  return postAccreditationAction(accessToken, id, "reject", { reviewNote });
}
