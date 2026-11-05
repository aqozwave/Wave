import { ApiError, type ApiErrorBody } from "./auth";

/** Relación laboral con el tenant. */
export type ContractorRole = "permanent" | "occasional";

/** Estado HAB (mismo set que accreditations). */
export type ContractorAccreditationStatus =
  | "invited"
  | "pending"
  | "in_review"
  | "observed"
  | "approved"
  | "rejected";

/** HAB más reciente embebida en la org. */
export type ContractorLatestAccreditation = {
  id: string;
  code: string;
  status: ContractorAccreditationStatus;
  requestedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

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
  latestAccreditation: ContractorLatestAccreditation | null;
  personCount: number;
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
    accreditationStatus?: ContractorAccreditationStatus | "none";
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
  if (filters?.accreditationStatus) {
    params.set("accreditationStatus", filters.accreditationStatus);
  }
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

/** Usuario invitado de una org (P9b). */
export type ContractorUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  run: string;
  confirmed: boolean;
  invitePending: boolean;
  state: boolean;
  internalRol: string;
  lastLoginAt: string | null;
  accessExpiresAt: string | null;
  createdAt: string;
};

/** Listado de usuarios de la org. */
export type ListContractorUsersResult = {
  items: ContractorUser[];
  total: number;
  page: number;
  limit: number;
};

/** Body invitar usuario. */
export type InviteContractorUserBody = {
  email: string;
  firstName: string;
  lastName: string;
  run: string;
  accessExpiresAt?: string | null;
};

/** GET /api/v1/contractors/:id/users */
export async function listContractorUsersRequest(
  accessToken: string,
  organizationId: string,
  page = 1,
  limit = 50,
): Promise<ListContractorUsersResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(
    `/api/v1/contractors/${organizationId}/users?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListContractorUsersResult;
}

/** POST /api/v1/contractors/:id/users — invita / vincula. */
export async function inviteContractorUserRequest(
  accessToken: string,
  organizationId: string,
  data: InviteContractorUserBody,
): Promise<ContractorUser> {
  const res = await fetch(`/api/v1/contractors/${organizationId}/users`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorUser;
}

/** Persona externa de la org. */
export type ContractorPerson = {
  id: string;
  organizationId: string;
  rut: string;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado de personal. */
export type ListContractorPeopleResult = {
  items: ContractorPerson[];
  total: number;
  page: number;
  limit: number;
};

/** Body create/patch persona. */
export type ContractorPersonWriteBody = {
  rut?: string;
  fullName?: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  emergencyContact?: string | null;
  active?: boolean;
};

/** GET /api/v1/contractors/:id/people */
export async function listContractorPeopleRequest(
  accessToken: string,
  organizationId: string,
  page = 1,
  limit = 50,
  filters?: { active?: boolean; search?: string },
): Promise<ListContractorPeopleResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.active !== undefined) {
    params.set("active", filters.active ? "true" : "false");
  }
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(
    `/api/v1/contractors/${organizationId}/people?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListContractorPeopleResult;
}

/** POST /api/v1/contractors/:id/people */
export async function createContractorPersonRequest(
  accessToken: string,
  organizationId: string,
  data: ContractorPersonWriteBody,
): Promise<ContractorPerson> {
  const res = await fetch(`/api/v1/contractors/${organizationId}/people`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPerson;
}

/** PATCH /api/v1/contractors/:id/people/:personId */
export async function updateContractorPersonRequest(
  accessToken: string,
  organizationId: string,
  personId: string,
  data: ContractorPersonWriteBody,
): Promise<ContractorPerson> {
  const res = await fetch(
    `/api/v1/contractors/${organizationId}/people/${personId}`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPerson;
}

/** DELETE /api/v1/contractors/:id/people/:personId (soft). */
export async function deleteContractorPersonRequest(
  accessToken: string,
  organizationId: string,
  personId: string,
): Promise<ContractorPerson> {
  const res = await fetch(
    `/api/v1/contractors/${organizationId}/people/${personId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPerson;
}

/** Resumen portal contratista (E3b). */
export type ContractorPortalSummary = {
  organization: {
    id: string;
    name: string;
    rut: string;
    specialty: string | null;
    role: string;
  };
  accreditation: {
    id: string;
    code: string;
    status: ContractorAccreditationStatus;
    message: string | null;
    dueAt: string | null;
    requestedAt: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
  companyDocuments: { uploaded: number; required: number };
  people: { total: number };
};

/** GET /api/v1/contractors/me/summary */
export async function getContractorPortalSummaryRequest(
  accessToken: string,
): Promise<ContractorPortalSummary> {
  const res = await fetch("/api/v1/contractors/me/summary", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPortalSummary;
}

/** HAB del portal (mismo shape que ContractorAccreditation interno). */
export type ContractorPortalAccreditation = {
  id: string;
  code: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    rut: string;
    businessId: string;
  };
  status: ContractorAccreditationStatus;
  message: string | null;
  reviewNote: string | null;
  requestedAt: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Ítem checklist pack company en portal. */
export type ContractorPortalDocChecklistItem = {
  documentType: {
    id: string;
    code: string;
    name: string;
    requiresExpiry: boolean;
  };
  document: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status:
      | "pending_validation"
      | "validated"
      | "observed"
      | "replaced";
    observation: string | null;
    expiresAt: string | null;
  } | null;
};

/** GET /contractors/me/accreditation */
export async function getContractorPortalAccreditationRequest(
  accessToken: string,
): Promise<ContractorPortalAccreditation> {
  const res = await fetch("/api/v1/contractors/me/accreditation", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPortalAccreditation;
}

/** GET /contractors/me/accreditation/documents */
export async function listContractorPortalDocumentsRequest(
  accessToken: string,
): Promise<{ items: ContractorPortalDocChecklistItem[]; total: number }> {
  const res = await fetch("/api/v1/contractors/me/accreditation/documents", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: ContractorPortalDocChecklistItem[]; total: number };
}

/** POST upload doc portal. */
export async function createContractorPortalDocumentRequest(
  accessToken: string,
  data: {
    documentTypeId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
    expiresAt?: string | null;
  },
): Promise<NonNullable<ContractorPortalDocChecklistItem["document"]> & {
  documentType: ContractorPortalDocChecklistItem["documentType"];
}> {
  const res = await fetch("/api/v1/contractors/me/accreditation/documents", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as NonNullable<ContractorPortalDocChecklistItem["document"]> & {
    documentType: ContractorPortalDocChecklistItem["documentType"];
  };
}

/** Descarga doc portal. */
export async function downloadContractorPortalDocumentRequest(
  accessToken: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(
    `/api/v1/contractors/me/accreditation/documents/${documentId}/download`,
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

/** POST enviar HAB a revisión. */
export async function submitContractorPortalAccreditationRequest(
  accessToken: string,
): Promise<ContractorPortalAccreditation> {
  const res = await fetch("/api/v1/contractors/me/accreditation/submit", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ContractorPortalAccreditation;
}
