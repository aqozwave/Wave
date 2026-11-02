import { ApiError, type ApiErrorBody } from "./auth";

/** Tipo de aviso. */
export type SystemAnnouncementKind = "version" | "maintenance" | "config";

/** Ítem de la campanita. */
export type SystemAnnouncement = {
  id: string;
  kind: SystemAnnouncementKind;
  title: string;
  body: string;
  metadata: unknown;
  publishedAt: string;
  read: boolean;
};

/** Respuesta list / mark-read. */
export type ListSystemAnnouncementsResult = {
  items: SystemAnnouncement[];
  unreadCount: number;
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

/** GET /system-announcements */
export async function listSystemAnnouncementsRequest(
  accessToken: string,
  limit = 20,
): Promise<ListSystemAnnouncementsResult> {
  const res = await fetch(
    `/api/v1/system-announcements?limit=${encodeURIComponent(String(limit))}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListSystemAnnouncementsResult;
}

/** POST /system-announcements/:id/read */
export async function markSystemAnnouncementReadRequest(
  accessToken: string,
  id: string,
): Promise<ListSystemAnnouncementsResult> {
  const res = await fetch(`/api/v1/system-announcements/${id}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListSystemAnnouncementsResult;
}

/** POST /system-announcements/read-all */
export async function markAllSystemAnnouncementsReadRequest(
  accessToken: string,
): Promise<ListSystemAnnouncementsResult> {
  const res = await fetch(`/api/v1/system-announcements/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListSystemAnnouncementsResult;
}
