import { ApiError, type ApiErrorBody } from "./auth";

/** Estado recalculado de la asignación. */
export type CrewTrainingStatus =
  | "pending"
  | "valid"
  | "expiring_soon"
  | "expired";

/** Capacitación embebida. */
export type CrewTrainingEmbed = {
  id: string;
  code: string;
  name: string;
  validityMonths: number | null;
  appliesTo: Array<"crew" | "external_person">;
  documentTypeId: string | null;
  active: boolean;
};

/** Evidencia documental embebida. */
export type CrewTrainingEvidenceEmbed = {
  id: string;
  originalName: string;
  mimeType: string;
  expiresAt: string | null;
  documentTypeId: string;
};

/** Asignación de capacitación a un tripulante. */
export type CrewMemberTraining = {
  id: string;
  crewMemberId: string;
  trainingId: string;
  training: CrewTrainingEmbed | null;
  completedAt: string | null;
  expiresAt: string | null;
  status: CrewTrainingStatus;
  evidenceDocumentId: string | null;
  evidenceDocument: CrewTrainingEvidenceEmbed | null;
  daysUntilExpiry: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado de la ficha. */
export type ListCrewMemberTrainingsResult = {
  items: CrewMemberTraining[];
  total: number;
};

/** Body alta. */
export type CreateCrewMemberTrainingBody = {
  trainingId: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  evidenceDocumentId?: string | null;
};

/** Body patch. */
export type UpdateCrewMemberTrainingBody = {
  completedAt?: string | null;
  expiresAt?: string | null;
  status?: CrewTrainingStatus;
  evidenceDocumentId?: string | null;
};

/** Body upload evidencia. */
export type UploadCrewMemberTrainingEvidenceBody = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  expiresAt?: string | null;
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

/** GET /crew-members/:id/trainings */
export async function listCrewMemberTrainingsRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<ListCrewMemberTrainingsResult> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/trainings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCrewMemberTrainingsResult;
}

/** POST /crew-members/:id/trainings */
export async function createCrewMemberTrainingRequest(
  accessToken: string,
  crewMemberId: string,
  data: CreateCrewMemberTrainingBody,
): Promise<CrewMemberTraining> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/trainings`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTraining;
}

/** PATCH /crew-members/:id/trainings/:assignmentId */
export async function updateCrewMemberTrainingRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
  data: UpdateCrewMemberTrainingBody,
): Promise<CrewMemberTraining> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/trainings/${assignmentId}`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTraining;
}

/** DELETE /crew-members/:id/trainings/:assignmentId */
export async function deleteCrewMemberTrainingRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberTraining> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/trainings/${assignmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTraining;
}

/** POST /crew-members/:id/trainings/:assignmentId/evidence */
export async function uploadCrewMemberTrainingEvidenceRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
  data: UploadCrewMemberTrainingEvidenceBody,
): Promise<CrewMemberTraining> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/trainings/${assignmentId}/evidence`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTraining;
}
