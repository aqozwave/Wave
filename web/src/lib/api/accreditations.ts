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

/** GET /api/v1/accreditations/:id */
export async function getAccreditationRequest(
  accessToken: string,
  id: string,
): Promise<ContractorAccreditation> {
  const res = await fetch(`/api/v1/accreditations/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorAccreditation;
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

/** Estado de doc de empresa en HAB. */
export type ContractorDocumentStatus =
  | "pending_validation"
  | "validated"
  | "observed"
  | "replaced";

/** Tipo en checklist P5. */
export type AccreditationPackDocumentType = {
  id: string;
  code: string;
  name: string;
  requiresExpiry: boolean;
};

/** Documento cargado (sin path). */
export type ContractorOrgDocument = {
  id: string;
  organizationId: string;
  accreditationId: string;
  documentTypeId: string;
  documentType: AccreditationPackDocumentType;
  originalName: string;
  mimeType: string;
  size: number;
  status: ContractorDocumentStatus;
  observation: string | null;
  expiresAt: string | null;
  uploadedById: string | null;
  validatedById: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Fila checklist: tipo + doc vigente. */
export type AccreditationDocumentChecklistItem = {
  documentType: AccreditationPackDocumentType;
  document: ContractorOrgDocument | null;
};

/** Listado checklist. */
export type ListAccreditationDocumentsResult = {
  items: AccreditationDocumentChecklistItem[];
  total: number;
};

/** Lee File → base64 puro (sin data-URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** GET /accreditations/:id/documents */
export async function listAccreditationDocumentsRequest(
  accessToken: string,
  accreditationId: string,
): Promise<ListAccreditationDocumentsResult> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/documents`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAccreditationDocumentsResult;
}

/** POST upload documento. */
export async function createAccreditationDocumentRequest(
  accessToken: string,
  accreditationId: string,
  data: {
    documentTypeId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
    expiresAt?: string | null;
  },
): Promise<ContractorOrgDocument> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/documents`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrgDocument;
}

/** POST validate/observe. */
export async function validateAccreditationDocumentRequest(
  accessToken: string,
  accreditationId: string,
  documentId: string,
  data: { status: "validated" | "observed"; observation?: string | null },
): Promise<ContractorOrgDocument> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/documents/${documentId}/validate`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorOrgDocument;
}

/** URL de descarga (Bearer no cabe en <a>; el caller hace fetch+blob). */
export function accreditationDocumentDownloadUrl(
  accreditationId: string,
  documentId: string,
  inline = false,
): string {
  const q = inline ? "?inline=1" : "";
  return `/api/v1/accreditations/${accreditationId}/documents/${documentId}/download${q}`;
}

/** Descarga autenticada → dispara save/open. */
export async function downloadAccreditationDocumentRequest(
  accessToken: string,
  accreditationId: string,
  documentId: string,
  fileName: string,
  inline = false,
): Promise<void> {
  const res = await fetch(
    accreditationDocumentDownloadUrl(accreditationId, documentId, inline),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Documento de persona en HAB. */
export type ContractorPersonDocument = {
  id: string;
  personId: string;
  accreditationId: string;
  documentTypeId: string;
  documentType: AccreditationPackDocumentType;
  originalName: string;
  mimeType: string;
  size: number;
  status: ContractorDocumentStatus;
  observation: string | null;
  expiresAt: string | null;
  uploadedById: string | null;
  validatedById: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Fila checklist pack person. */
export type AccreditationPersonDocumentChecklistItem = {
  documentType: AccreditationPackDocumentType;
  document: ContractorPersonDocument | null;
};

/** Listado checklist person. */
export type ListAccreditationPersonDocumentsResult = {
  items: AccreditationPersonDocumentChecklistItem[];
  total: number;
};

/** GET pack person de una persona en la HAB. */
export async function listAccreditationPersonDocumentsRequest(
  accessToken: string,
  accreditationId: string,
  personId: string,
): Promise<ListAccreditationPersonDocumentsResult> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/people/${personId}/documents`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAccreditationPersonDocumentsResult;
}

/** POST upload doc pack person. */
export async function createAccreditationPersonDocumentRequest(
  accessToken: string,
  accreditationId: string,
  personId: string,
  data: {
    documentTypeId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
    expiresAt?: string | null;
  },
): Promise<ContractorPersonDocument> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/people/${personId}/documents`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPersonDocument;
}

/** POST validate/observe doc person. */
export async function validateAccreditationPersonDocumentRequest(
  accessToken: string,
  accreditationId: string,
  personId: string,
  documentId: string,
  data: { status: "validated" | "observed"; observation?: string | null },
): Promise<ContractorPersonDocument> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/people/${personId}/documents/${documentId}/validate`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPersonDocument;
}

/** Descarga doc de persona. */
export async function downloadAccreditationPersonDocumentRequest(
  accessToken: string,
  accreditationId: string,
  personId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/people/${personId}/documents/${documentId}/download`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Evento del historial HAB (P5h). */
export type AccreditationHistoryItem = {
  id: string;
  createdAt: string;
  event: string;
  role: string | null;
  user: string | null;
  detail: string | null;
  result: string;
  resultTone: "success" | "warning" | "danger" | "info" | "neutral";
  success: boolean;
  action: string;
  resource: string;
};

/** Listado historial HAB. */
export type ListAccreditationHistoryResult = {
  items: AccreditationHistoryItem[];
  total: number;
  page: number;
  limit: number;
};

/** GET /accreditations/:id/history */
export async function listAccreditationHistoryRequest(
  accessToken: string,
  accreditationId: string,
  page = 1,
  limit = 10,
  filters?: { search?: string; success?: "true" | "false" },
): Promise<ListAccreditationHistoryResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.search) params.set("search", filters.search);
  if (filters?.success) params.set("success", filters.success);
  const res = await fetch(
    `/api/v1/accreditations/${accreditationId}/history?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListAccreditationHistoryResult;
}
