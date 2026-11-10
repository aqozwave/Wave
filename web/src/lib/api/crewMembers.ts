import { ApiError, type ApiErrorBody } from "./auth";

/** Tripulante tal como lo responde la API. */
export type CrewMember = {
  id: string;
  legacyMongoId: string | null;
  run: string;
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
  direction: string | null;
  observation: string | null;
  boardingBookValidUntil: string;
  businessId: string;
  locationId: string;
  areaId: string | null;
  rankId: string | null;
  academicDegreeId: string | null;
  competencyCertificateId: string | null;
  userId: string | null;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** % cursos obligatorios al día; null = sin obligatorios. */
  courseCompliancePercent: number | null;
};

/** Listado paginado. */
export type ListCrewMembersResult = {
  items: CrewMember[];
  total: number;
  page: number;
  limit: number;
};

/** Body create. */
export type CreateCrewMemberBody = {
  run: string;
  firstName: string;
  lastName: string;
  email: string;
  birthDate?: string | null;
  nationality?: string | null;
  phone?: string | null;
  direction?: string | null;
  observation?: string | null;
  boardingBookValidUntil: string;
  businessId?: string;
  locationId: string;
  areaId?: string | null;
  rankId?: string | null;
  academicDegreeId?: string | null;
  competencyCertificateId?: string | null;
  userId?: string | null;
  state?: boolean;
};

/** Body patch. */
export type UpdateCrewMemberBody = Partial<CreateCrewMemberBody>;

/** Query de listado. */
export type ListCrewMembersQuery = {
  page?: number;
  limit?: number;
  search?: string;
  businessId?: string;
  locationId?: string;
  includeInactive?: boolean;
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

/** GET /api/v1/crew-members */
export async function listCrewMembersRequest(
  accessToken: string,
  query: ListCrewMembersQuery = {},
): Promise<ListCrewMembersResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 100));
  params.set(
    "includeInactive",
    query.includeInactive === false ? "false" : "true",
  );
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.businessId) params.set("businessId", query.businessId);
  if (query.locationId) params.set("locationId", query.locationId);

  const res = await fetch(`/api/v1/crew-members?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCrewMembersResult;
}

/** GET /api/v1/crew-members/:id */
export async function getCrewMemberRequest(
  accessToken: string,
  id: string,
): Promise<CrewMember> {
  const res = await fetch(`/api/v1/crew-members/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMember;
}

/** POST /api/v1/crew-members */
export async function createCrewMemberRequest(
  accessToken: string,
  data: CreateCrewMemberBody,
): Promise<CrewMember> {
  const res = await fetch("/api/v1/crew-members", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMember;
}

/** PATCH /api/v1/crew-members/:id */
export async function updateCrewMemberRequest(
  accessToken: string,
  id: string,
  data: UpdateCrewMemberBody,
): Promise<CrewMember> {
  const res = await fetch(`/api/v1/crew-members/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMember;
}

/** DELETE /api/v1/crew-members/:id */
export async function deleteCrewMemberRequest(
  accessToken: string,
  id: string,
): Promise<CrewMember> {
  const res = await fetch(`/api/v1/crew-members/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMember;
}

/** Roles intercambiables en Acceso (User ↔ Colaborador). */
export type CrewAccessRoleKey = "user" | "colaborador";

/** Usuario vinculado en la pestaña Acceso. */
export type CrewAccessUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  run: string;
  internalRol: string;
  roleKey: string | null;
  roleName: string | null;
  dataScope: string | null;
  locationId: string | null;
  locationName: string | null;
  lastLoginAt: string | null;
  confirmed: boolean;
  state: boolean;
};

/** Estado Acceso (GET/POST/PATCH/DELETE …/access). */
export type CrewAccess = {
  linked: boolean;
  invitePending: boolean;
  scopeSummary: string | null;
  user: CrewAccessUser | null;
};

/** Body otorgar acceso. */
export type GrantCrewAccessBody = {
  email?: string;
  roleKey?: CrewAccessRoleKey;
};

/** Body cambiar rol. */
export type ChangeCrewAccessRoleBody = {
  roleKey: CrewAccessRoleKey;
};

/** GET /api/v1/crew-members/:id/access */
export async function getCrewMemberAccessRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<CrewAccess> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/access`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewAccess;
}

/** POST /api/v1/crew-members/:id/access */
export async function grantCrewMemberAccessRequest(
  accessToken: string,
  crewMemberId: string,
  data: GrantCrewAccessBody = {},
): Promise<CrewAccess> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/access`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewAccess;
}

/** PATCH /api/v1/crew-members/:id/access */
export async function changeCrewMemberAccessRoleRequest(
  accessToken: string,
  crewMemberId: string,
  data: ChangeCrewAccessRoleBody,
): Promise<CrewAccess> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/access`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewAccess;
}

/** DELETE /api/v1/crew-members/:id/access */
export async function revokeCrewMemberAccessRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<CrewAccess> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/access`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewAccess;
}

/** Categoría de evento en bitácora (Figma D31). */
export type CrewHistoryCategory =
  | "all"
  | "contract"
  | "document"
  | "course"
  | "observation"
  | "sanction"
  | "boarding";

/** Ítem de timeline de bitácora. */
export type CrewHistoryItem = {
  id: string;
  createdAt: string;
  title: string;
  detail: string | null;
  category:
    | "contract"
    | "document"
    | "course"
    | "observation"
    | "sanction"
    | "boarding";
  categoryLabel: string;
  statusLabel: string | null;
  statusTone: "success" | "warning" | "danger" | "info" | "neutral";
  actor: string | null;
  attachmentName: string | null;
};

/** Conteos del resumen lateral D31. */
export type CrewHistorySummary = {
  documents: number;
  courses: number;
  boardings: number;
  observations: number;
  sanctions: number;
  total: number;
};

/** Respuesta GET /crew-members/:id/history. */
export type ListCrewMemberHistoryResult = {
  items: CrewHistoryItem[];
  summary: CrewHistorySummary;
  total: number;
  page: number;
  limit: number;
};

/** Query GET /crew-members/:id/history. */
export type ListCrewMemberHistoryQuery = {
  page?: number;
  limit?: number;
  category?: CrewHistoryCategory;
};

/** GET /api/v1/crew-members/:id/history — bitácora D31. */
export async function listCrewMemberHistoryRequest(
  accessToken: string,
  crewMemberId: string,
  query: ListCrewMemberHistoryQuery = {},
): Promise<ListCrewMemberHistoryResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 50));
  if (query.category && query.category !== "all") {
    params.set("category", query.category);
  }

  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/history?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCrewMemberHistoryResult;
}
