import { ApiError, type ApiErrorBody } from "./auth";

/** Oficial de nave (API). */
export type OfficerKind = "captain" | "first_pilot";

/** Certificado de competencia tal como lo responde la API. */
export type CompetencyCertificate = {
  id: string;
  legacyMongoId: string | null;
  name: string;
  businessId: string;
  officerKind: OfficerKind | null;
  /** Si true, el embarcado debe tener muelles y travesías. */
  requiresMuelleTravesia: boolean;
  state: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListCompetencyCertificatesResult = {
  items: CompetencyCertificate[];
  total: number;
  page: number;
  limit: number;
};

/** Body create / patch. */
export type CompetencyCertificateWriteBody = {
  name?: string;
  businessId?: string;
  officerKind?: OfficerKind | null;
  requiresMuelleTravesia?: boolean;
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

/** GET /api/v1/competency-certificates */
export async function listCompetencyCertificatesRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: { businessId?: string; officerKind?: OfficerKind },
): Promise<ListCompetencyCertificatesResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.businessId) params.set("businessId", filters.businessId);
  if (filters?.officerKind) params.set("officerKind", filters.officerKind);
  const res = await fetch(`/api/v1/competency-certificates?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCompetencyCertificatesResult;
}

/** POST /api/v1/competency-certificates */
export async function createCompetencyCertificateRequest(
  accessToken: string,
  data: CompetencyCertificateWriteBody,
): Promise<CompetencyCertificate> {
  const res = await fetch("/api/v1/competency-certificates", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}

/** PATCH /api/v1/competency-certificates/:id */
export async function updateCompetencyCertificateRequest(
  accessToken: string,
  id: string,
  data: CompetencyCertificateWriteBody,
): Promise<CompetencyCertificate> {
  const res = await fetch(`/api/v1/competency-certificates/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}

/** DELETE /api/v1/competency-certificates/:id (soft). */
export async function deleteCompetencyCertificateRequest(
  accessToken: string,
  id: string,
): Promise<CompetencyCertificate> {
  const res = await fetch(`/api/v1/competency-certificates/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CompetencyCertificate;
}

/** Curso embebido en el join título↔curso. */
export type CertificateCourseEmbed = {
  id: string;
  name: string;
  whereTaught: string;
  description: string | null;
  isMandatory: boolean;
  state: boolean;
};

/** Fila del join. */
export type CompetencyCertificateCourseItem = {
  id: string;
  competencyCertificateId: string;
  courseId: string;
  isMandatory: boolean;
  course: CertificateCourseEmbed | null;
  createdAt: string;
  updatedAt: string;
};

/** Asignación corta (editor). */
export type CertificateCourseAssignment = {
  courseId: string;
  isMandatory: boolean;
};

/** GET /competency-certificates/:id/courses */
export type ListCompetencyCertificateCoursesResult = {
  items: CompetencyCertificateCourseItem[];
  assignments: CertificateCourseAssignment[];
};

/** PUT replace: set completo. */
export type ReplaceCompetencyCertificateCoursesBody = {
  assignments?: CertificateCourseAssignment[];
  courseIds?: string[];
};

/** Respuesta PUT con sync a tripulantes. */
export type ReplaceCompetencyCertificateCoursesResult =
  ListCompetencyCertificateCoursesResult & {
    sync: {
      crewMembersTotal: number;
      crewMembersUpdated: number;
      assignmentsCreated: number;
      assignmentsSkipped: number;
    };
  };

/** GET cursos vinculados al título. */
export async function listCompetencyCertificateCoursesRequest(
  accessToken: string,
  certificateId: string,
): Promise<ListCompetencyCertificateCoursesResult> {
  const res = await fetch(
    `/api/v1/competency-certificates/${certificateId}/courses`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCompetencyCertificateCoursesResult;
}

/** PUT reemplaza cursos del título (+ sync a embarcados con ese título). */
export async function replaceCompetencyCertificateCoursesRequest(
  accessToken: string,
  certificateId: string,
  data: ReplaceCompetencyCertificateCoursesBody,
): Promise<ReplaceCompetencyCertificateCoursesResult> {
  const res = await fetch(
    `/api/v1/competency-certificates/${certificateId}/courses`,
    {
      method: "PUT",
      headers: authHeaders(accessToken),
      body: JSON.stringify(data),
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ReplaceCompetencyCertificateCoursesResult;
}
