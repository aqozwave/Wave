import { ApiError, type ApiErrorBody } from "./auth";

/** Estado del aviso (no es el ciclo del PT). */
export type WorkNoticeStatus = "pending" | "linked" | "cancelled";

/** Org en el aviso + HAB más reciente. */
export type WorkNoticeOrganization = {
  id: string;
  name: string;
  rut: string;
  latestAccreditationStatus:
    | "invited"
    | "pending"
    | "in_review"
    | "observed"
    | "approved"
    | "rejected"
    | null;
};

/** Aviso de trabajo (AT1 / AT2). */
export type WorkNotice = {
  id: string;
  businessId: string;
  code: string;
  organizationId: string;
  organization: WorkNoticeOrganization;
  permitTypeId: string;
  permitType: { id: string; code: string; name: string };
  locationId: string;
  location: { id: string; name: string };
  /** Área solicitante (copia al crear). */
  requestingAreaId: string;
  requestingArea: { id: string; name: string };
  tentativeDate: string;
  estimatedDurationDays: number | null;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notifyByEmail: boolean;
  status: WorkNoticeStatus;
  workPermit: { id: string; code: string; status: string } | null;
  createdById: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListWorkNoticesResult = {
  items: WorkNotice[];
  total: number;
  page: number;
  limit: number;
};

/** Body crear aviso. */
export type CreateWorkNoticeBody = {
  organizationId: string;
  permitTypeId: string;
  locationId: string;
  tentativeDate: string;
  estimatedDurationDays?: number | null;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notifyByEmail?: boolean;
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

/** GET /api/v1/work-notices */
export async function listWorkNoticesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: {
    organizationId?: string;
    status?: WorkNoticeStatus;
    search?: string;
  },
): Promise<ListWorkNoticesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.organizationId) {
    params.set("organizationId", filters.organizationId);
  }
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/v1/work-notices?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListWorkNoticesResult;
}

/** GET /api/v1/work-notices/:id */
export async function getWorkNoticeRequest(
  accessToken: string,
  id: string,
): Promise<WorkNotice> {
  const res = await fetch(`/api/v1/work-notices/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkNotice;
}

/** POST /api/v1/work-notices */
export async function createWorkNoticeRequest(
  accessToken: string,
  data: CreateWorkNoticeBody,
): Promise<WorkNotice> {
  const res = await fetch("/api/v1/work-notices", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkNotice;
}
