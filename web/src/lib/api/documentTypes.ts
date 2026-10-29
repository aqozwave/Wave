import { ApiError, type ApiErrorBody } from "./auth";

/** Subtipos del maestro (API). */
export type DocumentSubtype =
  | "general"
  | "finiquito"
  | "requerimiento"
  | "prevencion"
  | "maritimo"
  | "activo";

/** Figma «Aplica a». */
export type DocumentAppliesTo = "crew" | "external" | "crew_and_external";

/** Figma «Lo suben» / «Lo ven». */
export type DocumentActorScope =
  | "prevention_or_admin"
  | "prevention_admin_hr_assets"
  | "admin"
  | "hr"
  | "assets";

/** Legacy: quién ve en el expediente. */
export type DocumentVisibility =
  | "nobody"
  | "employee"
  | "employee_supervisor"
  | "supervisor";

/** Tipo de documento tal como lo responde la API. */
export type DocumentType = {
  id: string;
  legacyMongoId: string | null;
  code: string;
  name: string;
  subtype: string;
  appliesTo: string;
  requiresExpiry: boolean;
  uploadBy: string;
  viewBy: string;
  crewCanView: boolean;
  visibility: string;
  businessId: string;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListDocumentTypesResult = {
  items: DocumentType[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type DocumentTypeWriteBody = {
  code?: string;
  name?: string;
  subtype?: DocumentSubtype;
  appliesTo?: DocumentAppliesTo;
  requiresExpiry?: boolean;
  uploadBy?: DocumentActorScope;
  viewBy?: DocumentActorScope;
  crewCanView?: boolean;
  visibility?: DocumentVisibility;
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

/** Headers Bearer + JSON. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/document-types */
export async function listDocumentTypesRequest(
  accessToken: string,
  page = 1,
  limit = 200,
  filters?: {
    businessId?: string;
    subtype?: DocumentSubtype;
    appliesTo?: DocumentAppliesTo;
    search?: string;
    /** Solo tipos que el actor puede subir a un tripulante. */
    forUpload?: boolean;
  },
): Promise<ListDocumentTypesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.subtype) params.set("subtype", filters.subtype);
  if (filters?.appliesTo) params.set("appliesTo", filters.appliesTo);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.forUpload) params.set("forUpload", "true");
  const res = await fetch(`/api/v1/document-types?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListDocumentTypesResult;
}

/** POST /api/v1/document-types */
export async function createDocumentTypeRequest(
  accessToken: string,
  data: DocumentTypeWriteBody,
): Promise<DocumentType> {
  const res = await fetch("/api/v1/document-types", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as DocumentType;
}

/** PATCH /api/v1/document-types/:id */
export async function updateDocumentTypeRequest(
  accessToken: string,
  id: string,
  data: DocumentTypeWriteBody,
): Promise<DocumentType> {
  const res = await fetch(`/api/v1/document-types/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as DocumentType;
}

/** DELETE /api/v1/document-types/:id (soft). */
export async function deleteDocumentTypeRequest(
  accessToken: string,
  id: string,
): Promise<DocumentType> {
  const res = await fetch(`/api/v1/document-types/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as DocumentType;
}
