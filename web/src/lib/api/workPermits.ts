import { ApiError, type ApiErrorBody } from "./auth";

/** Ciclo del permiso. */
export type WorkPermitStatus =
  | "to_complete"
  | "to_approve"
  | "to_receive"
  | "active"
  | "to_verify"
  | "closed"
  | "no_closure";

/** Permiso de trabajo PT-NNNN. */
export type WorkPermit = {
  id: string;
  businessId: string;
  code: string;
  workNoticeId: string;
  workNotice: { id: string; code: string };
  organizationId: string;
  organization: { id: string; name: string; rut: string };
  permitTypeId: string;
  permitType: { id: string; code: string; name: string };
  locationId: string;
  location: { id: string; name: string };
  scheduledDate: string;
  description: string | null;
  status: WorkPermitStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListWorkPermitsResult = {
  items: WorkPermit[];
  total: number;
  page: number;
  limit: number;
};

/** Parsea error Wave. */
function toApiError(res: Response, body: unknown): ApiError {
  const err = body as ApiErrorBody | null;
  return new ApiError(
    res.status,
    err?.code ?? "request_failed",
    err?.message ?? `HTTP ${res.status}`,
  );
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/work-permits */
export async function listWorkPermitsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: {
    organizationId?: string;
    status?: WorkPermitStatus;
    search?: string;
  },
): Promise<ListWorkPermitsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.organizationId) {
    params.set("organizationId", filters.organizationId);
  }
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/v1/work-permits?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListWorkPermitsResult;
}

/** GET /api/v1/work-permits/:id */
export async function getWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits — crear desde aviso. */
export async function createWorkPermitRequest(
  accessToken: string,
  data: { workNoticeId: string; description?: string | null },
): Promise<WorkPermit> {
  const res = await fetch("/api/v1/work-permits", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/submit — enviar a aprobación. */
export async function submitWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/submit`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}
