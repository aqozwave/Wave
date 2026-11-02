import { ApiError, type ApiErrorBody } from "./auth";

/** Estado recalculado de la asignación. */
export type CrewCourseStatus =
  | "pending"
  | "valid"
  | "expiring_soon"
  | "expired";

/** Origen de la fila. */
export type CrewCourseSource = "rank" | "certificate" | "manual";

/** Curso embebido. */
export type CrewCourseEmbed = {
  id: string;
  name: string;
  whereTaught: string;
  description: string | null;
  isMandatory: boolean;
  state: boolean;
};

/** Asignación de curso a un tripulante. */
export type CrewMemberCourse = {
  id: string;
  crewMemberId: string;
  courseId: string;
  course: CrewCourseEmbed | null;
  completedAt: string | null;
  expiresAt: string | null;
  status: CrewCourseStatus;
  source: CrewCourseSource;
  isMandatory: boolean;
  mandatorySource: "certificate" | "catalog";
  daysUntilExpiry: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado de la ficha. */
export type ListCrewMemberCoursesResult = {
  items: CrewMemberCourse[];
  total: number;
};

/** Body alta manual. */
export type CreateCrewMemberCourseBody = {
  courseId: string;
  completedAt?: string | null;
  expiresAt?: string | null;
};

/** Body patch fechas/estado. */
export type UpdateCrewMemberCourseBody = {
  completedAt?: string | null;
  expiresAt?: string | null;
  status?: CrewCourseStatus;
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

/** GET /crew-members/:id/courses */
export async function listCrewMemberCoursesRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<ListCrewMemberCoursesResult> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/courses`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCrewMemberCoursesResult;
}

/** POST /crew-members/:id/courses */
export async function createCrewMemberCourseRequest(
  accessToken: string,
  crewMemberId: string,
  data: CreateCrewMemberCourseBody,
): Promise<CrewMemberCourse> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/courses`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberCourse;
}

/** PATCH /crew-members/:id/courses/:assignmentId */
export async function updateCrewMemberCourseRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
  data: UpdateCrewMemberCourseBody,
): Promise<CrewMemberCourse> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/courses/${assignmentId}`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberCourse;
}

/** DELETE /crew-members/:id/courses/:assignmentId */
export async function deleteCrewMemberCourseRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberCourse> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/courses/${assignmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberCourse;
}

/**
 * Filtro del listado global.
 * attention = expired + expiring_soon (Vencimientos).
 */
export type ExpiryStatusFilter =
  | "all"
  | "pending"
  | "valid"
  | "expired"
  | "expiring_soon"
  | "attention";

/** Fila del listado global de asignaciones. */
export type ExpiringCrewMemberCourse = {
  id: string;
  crewMemberId: string;
  courseId: string;
  courseName: string;
  status: CrewCourseStatus;
  source: CrewCourseSource;
  daysUntilExpiry: number | null;
  completedAt: string | null;
  expiresAt: string | null;
  isMandatory: boolean;
  crew: {
    id: string;
    firstName: string;
    lastName: string;
    run: string;
    email: string;
    businessId: string;
  };
};

/** Respuesta paginada del listado global. */
export type ListExpiringCrewMemberCoursesResult = {
  items: ExpiringCrewMemberCourse[];
  total: number;
  page: number;
  limit: number;
  warningDays: number;
};

/** Query del listado global. */
export type ListExpiringCrewMemberCoursesQuery = {
  page?: number;
  limit?: number;
  status?: ExpiryStatusFilter;
  search?: string;
  businessId?: string;
};

/** GET /crew-member-courses — listado global (vencimientos / tripulación). */
export async function listExpiringCrewMemberCoursesRequest(
  accessToken: string,
  query: ListExpiringCrewMemberCoursesQuery = {},
): Promise<ListExpiringCrewMemberCoursesResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 25));
  params.set("status", query.status ?? "attention");
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.businessId) params.set("businessId", query.businessId);

  const res = await fetch(`/api/v1/crew-member-courses?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListExpiringCrewMemberCoursesResult;
}
