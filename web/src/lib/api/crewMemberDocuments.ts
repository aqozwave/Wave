import { ApiError, type ApiErrorBody } from "./auth";

/** Documento de tripulante (metadatos). */
export type CrewMemberDocument = {
  id: string;
  legacyMongoId: string | null;
  crewMemberId: string;
  type: string;
  originalName: string;
  mimeType: string;
  size: number;
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
  type?: "warning_letter";
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

/** URL de descarga (usar con Bearer vía fetch blob). */
export function crewMemberDocumentDownloadUrl(
  crewMemberId: string,
  documentId: string,
): string {
  return `/api/v1/crew-members/${crewMemberId}/documents/${documentId}/download`;
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
