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
