import { ApiError, type ApiErrorBody } from "./auth";

/** Ciclo del permiso. */
export type WorkPermitStatus =
  | "to_complete"
  | "to_approve"
  | "to_receive"
  | "active"
  | "to_verify"
  | "closed"
  | "no_closure";

/**
 * Etiqueta corta de UI para el ciclo del PT.
 * Los códigos internos no cambian; solo el copy visible.
 */
export function workPermitStatusLabel(status: WorkPermitStatus): string {
  switch (status) {
    case "to_complete":
      return "Por completar";
    case "to_approve":
      return "En revisión";
    case "to_receive":
      return "Aprobado Prevención";
    case "active":
      return "Autorizado a bordo";
    case "to_verify":
      return "Verificar trabajo";
    case "closed":
      return "Trabajo cerrado";
    case "no_closure":
      return "Sin cierre";
    default:
      return status;
  }
}

/**
 * Hitos del ciclo para la mini timeline (Figma P6 variante densa).
 * Orden fijo: Completar → … → Cerrado.
 */
export const WORK_PERMIT_PROGRESS_STEPS = [
  { key: "to_complete", label: "Completar", percent: 15 },
  { key: "to_approve", label: "Aprobar", percent: 30 },
  { key: "to_receive", label: "Recibir", percent: 50 },
  { key: "active", label: "Activo", percent: 70 },
  { key: "to_verify", label: "Verificar", percent: 85 },
  { key: "closed", label: "Cerrado", percent: 100 },
] as const;

/** Avance visual del PT: índice de hito + % fijo por estado (o — si sin cierre). */
export type WorkPermitProgress = {
  /** Índice 0..5 del hito actual (en no_closure = último). */
  stepIndex: number;
  /** % fijo por estado; null = sin cierre (mostrar —). */
  percent: number | null;
  /** true si el ciclo terminó en no_closure (tono danger). */
  terminalDanger: boolean;
  /** true si todos los hitos están completos (closed). */
  allComplete: boolean;
};

/**
 * Calcula avance denso a partir del status.
 * % fijo por estado (producto P6); no_closure → — + danger.
 */
export function workPermitProgress(
  status: WorkPermitStatus,
): WorkPermitProgress {
  switch (status) {
    case "to_complete":
      return {
        stepIndex: 0,
        percent: 15,
        terminalDanger: false,
        allComplete: false,
      };
    case "to_approve":
      return {
        stepIndex: 1,
        percent: 30,
        terminalDanger: false,
        allComplete: false,
      };
    case "to_receive":
      return {
        stepIndex: 2,
        percent: 50,
        terminalDanger: false,
        allComplete: false,
      };
    case "active":
      return {
        stepIndex: 3,
        percent: 70,
        terminalDanger: false,
        allComplete: false,
      };
    case "to_verify":
      return {
        stepIndex: 4,
        percent: 85,
        terminalDanger: false,
        allComplete: false,
      };
    case "closed":
      return {
        stepIndex: 5,
        percent: 100,
        terminalDanger: false,
        allComplete: true,
      };
    case "no_closure":
      return {
        stepIndex: 5,
        percent: null,
        terminalDanger: true,
        allComplete: false,
      };
    default:
      return {
        stepIndex: 0,
        percent: 15,
        terminalDanger: false,
        allComplete: false,
      };
  }
}

/** Permiso de trabajo PT-NNNN. */
export type WorkPermit = {
  id: string;
  businessId: string;
  code: string;
  workNoticeId: string;
  workNotice: { id: string; code: string };
  organizationId: string;
  organization: { id: string; name: string; rut: string };
  permitTypeId: string;
  permitType: { id: string; code: string; name: string };
  locationId: string;
  location: { id: string; name: string };
  scheduledDate: string;
  description: string | null;
  status: WorkPermitStatus;
  /** Motivo de la última devolución. */
  reviewNote: string | null;
  /** Snapshot de exigencias al crear (R-13); null en PT viejos. */
  requirementsSnapshot: unknown | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Estado de una exigencia en P13b. */
export type WorkPermitRequirementCheckStatus =
  | "ok"
  | "later"
  | "missing"
  | "not_applicable";

/** Ítem de verificación de exigencias. */
export type WorkPermitRequirementCheckItem = {
  requirementId: string;
  key: string;
  kind: "document" | "training" | "checklist";
  scope: "company" | "person" | "permit";
  moment: "before" | "closure";
  mandatory: boolean;
  label: string;
  status: WorkPermitRequirementCheckStatus;
  detail: string | null;
};

/** GET /work-permits/requirements-check. */
export type WorkPermitRequirementsCheck = {
  organizationId: string;
  organization: { id: string; name: string; rut: string };
  permitTypeId: string;
  permitType: { id: string; code: string; name: string };
  accreditation: { id: string; code: string; status: string } | null;
  summary: {
    ok: number;
    later: number;
    missing: number;
    notApplicable: number;
  };
  items: WorkPermitRequirementCheckItem[];
  canCreate: boolean;
};

export type ListWorkPermitsResult = {
  items: WorkPermit[];
  total: number;
  page: number;
  limit: number;
};

/** Parsea error Wave. */
function toApiError(res: Response, body: unknown): ApiError {
  const err = body as ApiErrorBody | null;
  return new ApiError(
    res.status,
    err?.code ?? "request_failed",
    err?.message ?? `HTTP ${res.status}`,
  );
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** GET /api/v1/work-permits */
export async function listWorkPermitsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
  filters?: {
    organizationId?: string;
    status?: WorkPermitStatus;
    search?: string;
  },
): Promise<ListWorkPermitsResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.organizationId) {
    params.set("organizationId", filters.organizationId);
  }
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/v1/work-permits?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListWorkPermitsResult;
}

/** GET /api/v1/work-permits/:id */
export async function getWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** GET /api/v1/work-permits/requirements-check — P13b. */
export async function checkWorkPermitRequirementsRequest(
  accessToken: string,
  organizationId: string,
  permitTypeId: string,
): Promise<WorkPermitRequirementsCheck> {
  const params = new URLSearchParams({ organizationId, permitTypeId });
  const res = await fetch(
    `/api/v1/work-permits/requirements-check?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermitRequirementsCheck;
}

/** POST /api/v1/work-permits — crear desde aviso. */
export async function createWorkPermitRequest(
  accessToken: string,
  data: { workNoticeId: string; description?: string | null },
): Promise<WorkPermit> {
  const res = await fetch("/api/v1/work-permits", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** DELETE /api/v1/work-permits/:id — soft-delete (+ aviso origen). */
export async function deleteWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/submit — enviar a aprobación. */
export async function submitWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/submit`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** Payload de firma digital (pad + aceptación). */
export type WorkPermitDigitalSignaturePayload = {
  signerName: string;
  accepted: true;
  signatureImage: string;
};

/** POST /api/v1/work-permits/:id/approve — Prevención aprueba (+ firma). */
export async function approveWorkPermitRequest(
  accessToken: string,
  id: string,
  signature: WorkPermitDigitalSignaturePayload,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/approve`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(signature),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/return — Prevención devuelve. */
export async function returnWorkPermitRequest(
  accessToken: string,
  id: string,
  reviewNote: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/return`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reviewNote }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/receive — capitán recibe a bordo (+ firma). */
export async function receiveWorkPermitRequest(
  accessToken: string,
  id: string,
  signature: WorkPermitDigitalSignaturePayload,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/receive`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(signature),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/reject-receipt — capitán no autoriza. */
export async function rejectReceiptWorkPermitRequest(
  accessToken: string,
  id: string,
  reviewNote: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/reject-receipt`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reviewNote }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/request-close — pedir cierre (P6a). */
export async function requestCloseWorkPermitRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/request-close`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/close — capitán cierra (P6b + firma). */
export async function closeWorkPermitRequest(
  accessToken: string,
  id: string,
  signature: WorkPermitDigitalSignaturePayload,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/close`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(signature),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** POST /api/v1/work-permits/:id/reject-close — capitán sin cierre (+ firma). */
export async function rejectCloseWorkPermitRequest(
  accessToken: string,
  id: string,
  reviewNote: string,
  signature: WorkPermitDigitalSignaturePayload,
): Promise<WorkPermit> {
  const res = await fetch(`/api/v1/work-permits/${id}/reject-close`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reviewNote, ...signature }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermit;
}

/** Firma de un hito del PT (documento imprimible P6c). */
export type WorkPermitDocumentSignature = {
  kind: string;
  label: string;
  signerName: string;
  signedAt: string;
  note: string | null;
  /** Trazo PNG (data URL) si hubo pad. */
  signatureImage: string | null;
  /** ISO de aceptación; null si solo registro automático. */
  acceptedAt: string | null;
};

/**
 * Hitos de firma del documento (mismo orden / labels que la API).
 * Cierre y «sin cierre» son alternativas; ambos se muestran hasta que uno exista.
 */
export const WORK_PERMIT_SIGNATURE_SLOTS: ReadonlyArray<{
  kind: WorkPermitDocumentSignature["kind"];
  label: string;
}> = [
  { kind: "prevention_approve", label: "Aprobación Prevención" },
  { kind: "captain_receive", label: "Autorización a bordo" },
  { kind: "contractor_request_close", label: "Solicitud de cierre" },
  { kind: "captain_close", label: "Cierre del trabajo" },
  { kind: "captain_no_closure", label: "Sin cierre" },
];

/** Empresa mandante (tenant) en la cabecera del documento imprimible. */
export type WorkPermitDocumentIssuer = {
  id: string;
  name: string;
  rut: string | null;
  giro: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
};

/** GET /api/v1/work-permits/:id/document — ficha + firmas. */
export type WorkPermitDocument = {
  issuer: WorkPermitDocumentIssuer;
  permit: WorkPermit;
  people: Array<{
    fullName: string;
    rut: string;
    position: string | null;
  }>;
  checklist: Array<{
    order: number;
    text: string;
    answer: "yes" | "no" | "na";
  }>;
  signatures: WorkPermitDocumentSignature[];
};

/** GET /api/v1/work-permits/:id/document. */
export async function getWorkPermitDocumentRequest(
  accessToken: string,
  id: string,
): Promise<WorkPermitDocument> {
  const res = await fetch(`/api/v1/work-permits/${id}/document`, {
    headers: authHeaders(accessToken),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as WorkPermitDocument;
}

/** Persona asignada al PT (+ readiness docs para revisión). */
export type WorkPermitPerson = {
  personId: string;
  fullName: string;
  rut: string;
  position: string | null;
  presentAt: string | null;
  accreditationId: string | null;
  packComplete: boolean;
  pendingPackCodes: string[];
  absentPackCodes: string[];
  missingRequirementLabels: string[];
  pendingRequirementLabels: string[];
  absentRequirementLabels: string[];
  docsOk: boolean;
};

/** Valor de checklist. */
export type WorkPermitChecklistAnswerValue = "yes" | "no" | "na";

/** Ítem de checklist con respuesta. */
export type WorkPermitChecklistItem = {
  checklistItemId: string;
  order: number;
  text: string;
  answer: WorkPermitChecklistAnswerValue | null;
  answeredAt: string | null;
};

/** Persona activa con readiness para asignar al PT. */
export type WorkPermitAssignablePerson = {
  personId: string;
  fullName: string;
  rut: string;
  position: string | null;
  packComplete: boolean;
  missingPackCodes: string[];
  pendingPackCodes: string[];
  absentPackCodes: string[];
  missingRequirementLabels: string[];
  missingRequirementCodes: string[];
  pendingRequirementLabels: string[];
  absentRequirementLabels: string[];
  accreditationId: string | null;
  canAssign: boolean;
};

/** GET /api/v1/work-permits/:id/assignable-people */
export async function listWorkPermitAssignablePeopleRequest(
  accessToken: string,
  id: string,
): Promise<{
  items: WorkPermitAssignablePerson[];
  personRequirementLabels: string[];
}> {
  const res = await fetch(`/api/v1/work-permits/${id}/assignable-people`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as {
    items: WorkPermitAssignablePerson[];
    personRequirementLabels: string[];
  };
}

/** GET /api/v1/work-permits/:id/people */
export async function listWorkPermitPeopleRequest(
  accessToken: string,
  id: string,
): Promise<{
  items: WorkPermitPerson[];
  personRequirementLabels: string[];
}> {
  const res = await fetch(`/api/v1/work-permits/${id}/people`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as {
    items: WorkPermitPerson[];
    personRequirementLabels: string[];
  };
}

/** PUT /api/v1/work-permits/:id/people */
export async function putWorkPermitPeopleRequest(
  accessToken: string,
  id: string,
  personIds: string[],
): Promise<{
  items: WorkPermitPerson[];
  personRequirementLabels: string[];
}> {
  const res = await fetch(`/api/v1/work-permits/${id}/people`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ personIds }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as {
    items: WorkPermitPerson[];
    personRequirementLabels: string[];
  };
}

/** GET /api/v1/work-permits/:id/checklist */
export async function getWorkPermitChecklistRequest(
  accessToken: string,
  id: string,
  stage: "contractor" | "reception" | "closure" = "contractor",
): Promise<{ stage: string; items: WorkPermitChecklistItem[] }> {
  const params = new URLSearchParams({ stage });
  const res = await fetch(`/api/v1/work-permits/${id}/checklist?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { stage: string; items: WorkPermitChecklistItem[] };
}

/** PUT /api/v1/work-permits/:id/checklist */
export async function putWorkPermitChecklistRequest(
  accessToken: string,
  id: string,
  answers: {
    checklistItemId: string;
    answer: WorkPermitChecklistAnswerValue;
  }[],
  stage: "contractor" | "reception" | "closure" = "contractor",
): Promise<{ stage: string; items: WorkPermitChecklistItem[] }> {
  const res = await fetch(`/api/v1/work-permits/${id}/checklist`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ stage, answers }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { stage: string; items: WorkPermitChecklistItem[] };
}

/** Evento del historial del PT. */
export type WorkPermitHistoryItem = {
  id: string;
  createdAt: string;
  event: string;
  role: string | null;
  user: string | null;
  detail: string | null;
  result: string;
  resultTone: "success" | "warning" | "danger" | "info" | "neutral";
  success: boolean;
  action: string;
  resource: string;
};

/** GET /api/v1/work-permits/:id/history */
export async function listWorkPermitHistoryRequest(
  accessToken: string,
  id: string,
  page = 1,
  limit = 20,
  filters?: { search?: string; success?: "true" | "false" },
): Promise<{
  items: WorkPermitHistoryItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters?.search) params.set("search", filters.search);
  if (filters?.success) params.set("success", filters.success);
  const res = await fetch(`/api/v1/work-permits/${id}/history?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as {
    items: WorkPermitHistoryItem[];
    total: number;
    page: number;
    limit: number;
  };
}
