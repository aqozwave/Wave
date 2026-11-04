import { ApiError, type ApiErrorBody } from "./auth";

/** Criticidad del tipo de permiso. */
export type PermitCriticality = "low" | "medium" | "high";

/** Modo AST. */
export type PermitAstMode = "form" | "pdf" | "both";

/** Tipo de permiso (catálogo P1). */
export type PermitType = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  criticality: PermitCriticality;
  requiresAst: boolean;
  astMode: PermitAstMode | null;
  description: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListPermitTypesResult = {
  items: PermitType[];
  total: number;
  page: number;
  limit: number;
};

/** Exigencia de un tipo. */
export type PermitTypeRequirement = {
  id: string;
  permitTypeId: string;
  key: string;
  kind: "document" | "training" | "checklist";
  scope: "company" | "person" | "permit";
  moment: "before" | "closure";
  mandatory: boolean;
  documentTypeId: string | null;
  documentType: { id: string; code: string; name: string } | null;
  accreditationScope: "company" | "person" | null;
  trainingCode: string | null;
  trainingId: string | null;
  training: { id: string; code: string; name: string } | null;
  label: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Ítem de checklist. */
export type PermitChecklistItem = {
  id: string;
  permitTypeId: string;
  order: number;
  text: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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

/** GET /api/v1/permit-types */
export async function listPermitTypesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; search?: string; active?: boolean },
): Promise<ListPermitTypesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.active !== undefined) {
    params.set("active", filters.active ? "true" : "false");
  }
  const res = await fetch(`/api/v1/permit-types?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListPermitTypesResult;
}

/** GET /api/v1/permit-types/:id */
export async function getPermitTypeRequest(
  accessToken: string,
  id: string,
): Promise<PermitType> {
  const res = await fetch(`/api/v1/permit-types/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as PermitType;
}

/** GET /api/v1/permit-types/:id/requirements */
export async function listPermitTypeRequirementsRequest(
  accessToken: string,
  permitTypeId: string,
): Promise<{ items: PermitTypeRequirement[]; total: number }> {
  const res = await fetch(
    `/api/v1/permit-types/${permitTypeId}/requirements`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: PermitTypeRequirement[]; total: number };
}

/** GET /api/v1/permit-types/:id/checklist-items */
export async function listPermitChecklistItemsRequest(
  accessToken: string,
  permitTypeId: string,
): Promise<{ items: PermitChecklistItem[]; total: number }> {
  const res = await fetch(
    `/api/v1/permit-types/${permitTypeId}/checklist-items`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: PermitChecklistItem[]; total: number };
}

/** Body alta de tipo. */
export type CreatePermitTypeBody = {
  code: string;
  name: string;
  criticality: PermitCriticality;
  requiresAst?: boolean;
  astMode?: PermitAstMode | null;
  description?: string;
  businessId?: string;
  active?: boolean;
};

/** Body patch de tipo. */
export type UpdatePermitTypeBody = Partial<CreatePermitTypeBody>;

/** Headers JSON + Bearer. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** POST /api/v1/permit-types */
export async function createPermitTypeRequest(
  accessToken: string,
  data: CreatePermitTypeBody,
): Promise<PermitType> {
  const res = await fetch("/api/v1/permit-types", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as PermitType;
}

/** PATCH /api/v1/permit-types/:id */
export async function updatePermitTypeRequest(
  accessToken: string,
  id: string,
  data: UpdatePermitTypeBody,
): Promise<PermitType> {
  const res = await fetch(`/api/v1/permit-types/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as PermitType;
}

/** DELETE /api/v1/permit-types/:id — soft (active=false + deletedAt). */
export async function deletePermitTypeRequest(
  accessToken: string,
  id: string,
): Promise<PermitType> {
  const res = await fetch(`/api/v1/permit-types/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as PermitType;
}
