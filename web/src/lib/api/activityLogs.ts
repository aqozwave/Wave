import { ApiError, type ApiErrorBody } from "./auth";

/** Acciones de auditoría. */
export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "CREATE"
  | "UPDATE"
  | "DELETE";

/** Recursos auditables. */
export type ActivityResource =
  | "auth"
  | "user"
  | "business"
  | "location"
  | "crewMember"
  | "crewMemberCourse"
  | "area"
  | "rank"
  | "academicDegree"
  | "competencyCertificate"
  | "documentType"
  | "muelle"
  | "travesia"
  | "port"
  | "course"
  | "role"
  | "system";

/** Fila del registro de actividad. */
export type ActivityLog = {
  id: string;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetLabel: string | null;
  success: boolean;
  errorMessage: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

/** Query del listado. */
export type ListActivityLogsQuery = {
  page?: number;
  limit?: number;
  action?: ActivityAction;
  resource?: ActivityResource;
  success?: "true" | "false";
};

/** Respuesta paginada. */
export type ListActivityLogsResult = {
  items: ActivityLog[];
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

/** GET /activity-logs — solo superadmin. */
export async function listActivityLogsRequest(
  accessToken: string,
  query: ListActivityLogsQuery = {},
): Promise<ListActivityLogsResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 30));
  if (query.action) params.set("action", query.action);
  if (query.resource) params.set("resource", query.resource);
  if (query.success) params.set("success", query.success);

  const res = await fetch(`/api/v1/activity-logs?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListActivityLogsResult;
}
