import { ApiError, type ApiErrorBody } from "./auth";

/** Estado de sesión grupal/individual. */
export type TrainingSessionStatus = "draft" | "completed" | "cancelled";

/** Capacitación embebida. */
export type TrainingSessionTraining = {
  id: string;
  code: string;
  name: string;
  validityMonths: number | null;
  documentTypeId: string | null;
};

/** Asistente de la sesión. */
export type TrainingSessionAttendee = {
  id: string;
  crewMemberId: string;
  crewMemberName: string;
  crewMemberRun: string;
  crewMemberTrainingId: string | null;
  evidenceDocumentId: string | null;
  logEntryId: string | null;
};

/** Nave embebida en la sesión. */
export type TrainingSessionLocation = {
  id: string;
  name: string;
};

/** Sesión de capacitación. */
export type TrainingSession = {
  id: string;
  businessId: string;
  locationId: string;
  location: TrainingSessionLocation | null;
  trainingId: string;
  training: TrainingSessionTraining | null;
  heldAt: string;
  status: TrainingSessionStatus;
  notes: string | null;
  hasCertificate: boolean;
  fileOriginalName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  closedAt: string | null;
  closedById: string | null;
  createdById: string | null;
  attendeeCount: number;
  attendees: TrainingSessionAttendee[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListTrainingSessionsResult = {
  items: TrainingSession[];
  total: number;
  page: number;
  limit: number;
};

/** Body alta borrador. */
export type CreateTrainingSessionBody = {
  trainingId: string;
  locationId: string;
  heldAt: string;
  notes?: string | null;
  businessId?: string;
  crewMemberIds: string[];
};

/** Body patch borrador. */
export type UpdateTrainingSessionBody = {
  heldAt?: string;
  notes?: string | null;
  crewMemberIds?: string[];
};

/** Body upload acta. */
export type UploadTrainingSessionCertificateBody = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
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

/** GET /api/v1/training-sessions */
export async function listTrainingSessionsRequest(
  accessToken: string,
  page = 1,
  limit = 50,
  filters?: {
    businessId?: string;
    trainingId?: string;
    status?: TrainingSessionStatus;
  },
): Promise<ListTrainingSessionsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.trainingId) params.set("trainingId", filters.trainingId);
  if (filters?.status) params.set("status", filters.status);
  const res = await fetch(`/api/v1/training-sessions?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListTrainingSessionsResult;
}

/** GET /api/v1/training-sessions/:id */
export async function getTrainingSessionRequest(
  accessToken: string,
  id: string,
): Promise<TrainingSession> {
  const res = await fetch(`/api/v1/training-sessions/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}

/** POST /api/v1/training-sessions */
export async function createTrainingSessionRequest(
  accessToken: string,
  data: CreateTrainingSessionBody,
): Promise<TrainingSession> {
  const res = await fetch("/api/v1/training-sessions", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}

/** PATCH /api/v1/training-sessions/:id */
export async function updateTrainingSessionRequest(
  accessToken: string,
  id: string,
  data: UpdateTrainingSessionBody,
): Promise<TrainingSession> {
  const res = await fetch(`/api/v1/training-sessions/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}

/** POST /api/v1/training-sessions/:id/certificate */
export async function uploadTrainingSessionCertificateRequest(
  accessToken: string,
  id: string,
  data: UploadTrainingSessionCertificateBody,
): Promise<TrainingSession> {
  const res = await fetch(`/api/v1/training-sessions/${id}/certificate`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}

/** POST /api/v1/training-sessions/:id/complete */
export async function completeTrainingSessionRequest(
  accessToken: string,
  id: string,
): Promise<TrainingSession> {
  const res = await fetch(`/api/v1/training-sessions/${id}/complete`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}

/** DELETE /api/v1/training-sessions/:id */
export async function cancelTrainingSessionRequest(
  accessToken: string,
  id: string,
): Promise<TrainingSession> {
  const res = await fetch(`/api/v1/training-sessions/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as TrainingSession;
}
