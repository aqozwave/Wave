import { ApiError, type ApiErrorBody } from "./auth";

/** Relación laboral con el tenant. */
export type ContractorRole = "permanent" | "occasional";

/** Organización contratista (P2). */
export type ContractorOrganization = {
  id: string;
  businessId: string;
  name: string;
  rut: string;
  role: ContractorRole;
  specialty: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  legalRepresentative: string | null;
  address: string | null;
  mutual: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  prevencionistName: string | null;
  prevencionistEmail: string | null;
  subcontractors: string | null;
  workDescription: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListContractorsResult = {
  items: ContractorOrganization[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type ContractorWriteBody = {
  name?: string;
  rut?: string;
  role?: ContractorRole;
  specialty?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  legalRepresentative?: string | null;
  address?: string | null;
  mutual?: string | null;
  supervisorName?: string | null;
  supervisorEmail?: string | null;
  prevencionistName?: string | null;
  prevencionistEmail?: string | null;
  subcontractors?: string | null;
  workDescription?: string | null;
  businessId?: string;
  active?: boolean;
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

/** GET /api/v1/contractors */
export async function listContractorsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: {
    businessId?: string;
    active?: boolean;
    role?: ContractorRole;
    search?: string;
  },
): Promise<ListContractorsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.active !== undefined) {
    params.set("active", filters.active ? "true" : "false");
  }
  if (filters?.role) params.set("role", filters.role);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/v1/contractors?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListContractorsResult;
}

/** GET /api/v1/contractors/:id */
export async function getContractorRequest(
  accessToken: string,
  id: string,
): Promise<ContractorOrganization> {
  const res = await fetch(`/api/v1/contractors/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrganization;
}

/** POST /api/v1/contractors */
export async function createContractorRequest(
  accessToken: string,
  data: ContractorWriteBody,
): Promise<ContractorOrganization> {
  const res = await fetch("/api/v1/contractors", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrganization;
}

/** PATCH /api/v1/contractors/:id */
export async function updateContractorRequest(
  accessToken: string,
  id: string,
  data: ContractorWriteBody,
): Promise<ContractorOrganization> {
  const res = await fetch(`/api/v1/contractors/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrganization;
}

/** DELETE /api/v1/contractors/:id (soft). */
export async function deleteContractorRequest(
  accessToken: string,
  id: string,
): Promise<ContractorOrganization> {
  const res = await fetch(`/api/v1/contractors/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrganization;
}
