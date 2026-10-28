import { ApiError, type ApiErrorBody } from "./auth";

/** Asignación muelle. */
export type CrewMemberMuelle = {
  id: string;
  legacyMongoId: string | null;
  crewMemberId: string;
  muelleId: string;
  muelleName: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Asignación travesía. */
export type CrewMemberTravesia = {
  id: string;
  legacyMongoId: string | null;
  crewMemberId: string;
  travesiaId: string;
  travesiaName: string;
  requiredPassages: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

/** GET …/muelles */
export async function listCrewMemberMuellesRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<{ items: CrewMemberMuelle[]; total: number }> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/muelles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: CrewMemberMuelle[]; total: number };
}

/** POST …/muelles */
export async function createCrewMemberMuelleRequest(
  accessToken: string,
  crewMemberId: string,
  muelleId: string,
): Promise<CrewMemberMuelle> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/muelles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ muelleId }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberMuelle;
}

/** DELETE …/muelles/:assignmentId */
export async function deleteCrewMemberMuelleRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberMuelle> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/muelles/${assignmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberMuelle;
}

/** GET …/travesias */
export async function listCrewMemberTravesiasRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<{ items: CrewMemberTravesia[]; total: number }> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/travesias`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: CrewMemberTravesia[]; total: number };
}

/** POST …/travesias */
export async function createCrewMemberTravesiaRequest(
  accessToken: string,
  crewMemberId: string,
  travesiaId: string,
): Promise<CrewMemberTravesia> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/travesias`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ travesiaId }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTravesia;
}

/** DELETE …/travesias/:assignmentId */
export async function deleteCrewMemberTravesiaRequest(
  accessToken: string,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberTravesia> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/travesias/${assignmentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberTravesia;
}
