import { ApiError, type ApiErrorBody } from "./auth";

/** Capacitación del catálogo Prevención. */
export type Training = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  validityMonths: number | null;
  appliesTo: Array<"crew" | "external_person">;
  documentTypeId: string | null;
  documentType: { id: string; code: string; name: string } | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListTrainingsResult = {
  items: Training[];
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

/** GET /api/v1/trainings */
export async function listTrainingsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; search?: string; active?: boolean },
): Promise<ListTrainingsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.active !== undefined) {
    params.set("active", filters.active ? "true" : "false");
  }
  const res = await fetch(`/api/v1/trainings?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListTrainingsResult;
}
