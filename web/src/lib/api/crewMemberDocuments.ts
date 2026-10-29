import { ApiError, type ApiErrorBody } from "./auth";

/** Resumen del tipo maestro embebido en el documento. */
export type DocumentTypeSummary = {
  id: string;
  code: string;
  name: string;
  subtype: string;
};

/** Documento de tripulante (metadatos). */
export type CrewMemberDocument = {
  id: string;
  legacyMongoId: string | null;
  crewMemberId: string;
  documentTypeId: string;
  documentType: DocumentTypeSummary;
  originalName: string;
  mimeType: string;
  size: number;
  sourceModule: string;
  uploadedById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado. */
export type ListCrewMemberDocumentsResult = {
  items: CrewMemberDocument[];
  total: number;
};

/** Body create (archivo en base64). */
export type CreateCrewMemberDocumentBody = {
  documentTypeId: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  sourceModule?: "crew" | "prevention" | "assets" | "system";
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

/** GET /crew-members/:id/documents */
export async function listCrewMemberDocumentsRequest(
  accessToken: string,
  crewMemberId: string,
): Promise<ListCrewMemberDocumentsResult> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/documents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListCrewMemberDocumentsResult;
}

/** POST /crew-members/:id/documents */
export async function createCrewMemberDocumentRequest(
  accessToken: string,
  crewMemberId: string,
  data: CreateCrewMemberDocumentBody,
): Promise<CrewMemberDocument> {
  const res = await fetch(`/api/v1/crew-members/${crewMemberId}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberDocument;
}

/** DELETE /crew-members/:id/documents/:documentId */
export async function deleteCrewMemberDocumentRequest(
  accessToken: string,
  crewMemberId: string,
  documentId: string,
): Promise<CrewMemberDocument> {
  const res = await fetch(
    `/api/v1/crew-members/${crewMemberId}/documents/${documentId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as CrewMemberDocument;
}

/** URL de descarga / vista (usar con Bearer vía fetch blob). */
export function crewMemberDocumentDownloadUrl(
  crewMemberId: string,
  documentId: string,
  inline = false,
): string {
  const base = `/api/v1/crew-members/${crewMemberId}/documents/${documentId}/download`;
  return inline ? `${base}?inline=1` : base;
}

/** Descarga el archivo y dispara save-as en el navegador. */
export async function downloadCrewMemberDocumentRequest(
  accessToken: string,
  crewMemberId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(
    crewMemberDocumentDownloadUrl(crewMemberId, documentId),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Abre el documento en una pestaña nueva (PDF/imagen).
 * Pide el stream con disposition inline.
 */
export async function previewCrewMemberDocumentRequest(
  accessToken: string,
  crewMemberId: string,
  documentId: string,
): Promise<void> {
  const res = await fetch(
    crewMemberDocumentDownloadUrl(crewMemberId, documentId, true),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new ApiError(
      0,
      "popup_blocked",
      "El navegador bloqueó la vista previa. Permití ventanas emergentes.",
    );
  }
  // Liberar el blob cuando la pestaña ya pudo cargarlo.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Lee File → base64 (sin prefijo data:). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer"));
    reader.readAsDataURL(file);
  });
}
