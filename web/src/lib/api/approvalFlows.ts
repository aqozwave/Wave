import { ApiError, type ApiErrorBody } from "./auth";

/** Actor de una etapa P16. */
export type ApprovalFlowStageActor =
  | "requesting_area"
  | "prevention"
  | "contractor"
  | "captain";

/** Momento de una etapa. */
export type ApprovalFlowStageMoment = "before" | "on_arrival" | "on_finish";

/** Etapa de un flujo. */
export type ApprovalFlowStage = {
  id: string;
  flowId: string;
  position: number;
  key: string;
  label: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
  requiresSignature: boolean;
  mandatory: boolean;
  fixed: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Fila de listado (sin etapas). */
export type ApprovalFlowListItem = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  copiedFromId: string | null;
  active: boolean;
  stageCount: number;
  typeCount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Detalle con etapas. */
export type ApprovalFlowDetail = ApprovalFlowListItem & {
  stages: ApprovalFlowStage[];
};

/** Listado paginado. */
export type ListApprovalFlowsResult = {
  items: ApprovalFlowListItem[];
  total: number;
  page: number;
  limit: number;
};

/** Body alta (copia de EST). */
export type CreateApprovalFlowBody = {
  businessId: string;
  code: string;
  name: string;
  description?: string | null;
  sourceFlowId?: string;
  /** 1..8 etapas al crear. */
  stageCount?: number;
};

/** Body patch flujo. */
export type UpdateApprovalFlowBody = {
  name?: string;
  description?: string | null;
  active?: boolean;
};

/** Body alta etapa. */
/** Dónde insertar la etapa en el orden del flujo. */
export type ApprovalFlowStagePlacement = "start" | "middle" | "end";

export type CreateApprovalFlowStageBody = {
  key: string;
  label: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
  requiresSignature?: boolean;
  mandatory?: boolean;
  /** start = inicio · middle = antes del cierre · end = al final. */
  placement?: ApprovalFlowStagePlacement;
};

/** Body patch etapa. */
export type UpdateApprovalFlowStageBody = {
  label?: string;
  actor?: ApprovalFlowStageActor;
  moment?: ApprovalFlowStageMoment;
  requiresSignature?: boolean;
  mandatory?: boolean;
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

/** Headers JSON + Bearer. */
function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/approval-flows */
export async function listApprovalFlowsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; search?: string; active?: boolean },
): Promise<ListApprovalFlowsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.active !== undefined) {
    params.set("active", filters.active ? "true" : "false");
  }
  const res = await fetch(`/api/v1/approval-flows?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListApprovalFlowsResult;
}

/** GET /api/v1/approval-flows/:id */
export async function getApprovalFlowRequest(
  accessToken: string,
  id: string,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(`/api/v1/approval-flows/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** POST /api/v1/approval-flows */
export async function createApprovalFlowRequest(
  accessToken: string,
  data: CreateApprovalFlowBody,
): Promise<ApprovalFlowDetail> {
  const res = await fetch("/api/v1/approval-flows", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** PATCH /api/v1/approval-flows/:id */
export async function updateApprovalFlowRequest(
  accessToken: string,
  id: string,
  data: UpdateApprovalFlowBody,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(`/api/v1/approval-flows/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** DELETE /api/v1/approval-flows/:id (soft-delete personalizado). */
export async function deleteApprovalFlowRequest(
  accessToken: string,
  id: string,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(`/api/v1/approval-flows/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** POST /api/v1/approval-flows/:id/stages */
export async function addApprovalFlowStageRequest(
  accessToken: string,
  flowId: string,
  data: CreateApprovalFlowStageBody,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(`/api/v1/approval-flows/${flowId}/stages`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** PATCH /api/v1/approval-flows/:id/stages/:stageId */
export async function updateApprovalFlowStageRequest(
  accessToken: string,
  flowId: string,
  stageId: string,
  data: UpdateApprovalFlowStageBody,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(
    `/api/v1/approval-flows/${flowId}/stages/${stageId}`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}

/** DELETE /api/v1/approval-flows/:id/stages/:stageId */
export async function deleteApprovalFlowStageRequest(
  accessToken: string,
  flowId: string,
  stageId: string,
): Promise<ApprovalFlowDetail> {
  const res = await fetch(
    `/api/v1/approval-flows/${flowId}/stages/${stageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ApprovalFlowDetail;
}
