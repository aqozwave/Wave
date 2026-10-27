import { ApiError, type ApiErrorBody } from "./auth";

/** Curso del catálogo tal como lo responde la API. */
export type Course = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  whereTaught: string;
  businessId: string;
  description: string | null;
  isMandatory: boolean;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListCoursesResult = {
  items: Course[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type CourseWriteBody = {
  name?: string;
  whereTaught?: string;
  businessId?: string;
  description?: string | null;
  isMandatory?: boolean;
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

/** Headers Bearer. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/courses */
export async function listCoursesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string },
): Promise<ListCoursesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  const res = await fetch(`/api/v1/courses?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCoursesResult;
}

/** POST /api/v1/courses */
export async function createCourseRequest(
  accessToken: string,
  data: CourseWriteBody,
): Promise<Course> {
  const res = await fetch("/api/v1/courses", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Course;
}

/** PATCH /api/v1/courses/:id */
export async function updateCourseRequest(
  accessToken: string,
  id: string,
  data: CourseWriteBody,
): Promise<Course> {
  const res = await fetch(`/api/v1/courses/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Course;
}

/** DELETE /api/v1/courses/:id (soft). */
export async function deleteCourseRequest(
  accessToken: string,
  id: string,
): Promise<Course> {
  const res = await fetch(`/api/v1/courses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as Course;
}
