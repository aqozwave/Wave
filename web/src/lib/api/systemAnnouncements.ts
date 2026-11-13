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

/** Ítem del listado admin. */
export type SystemAnnouncementAdmin = {
  id: string;
  kind: SystemAnnouncementKind;
  title: string;
  body: string;
  metadata: unknown;
  publishedAt: string;
  expiresAt: string | null;
  dedupeKey: string | null;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Body create / patch admin. */
export type SystemAnnouncementWriteBody = {
  kind?: SystemAnnouncementKind;
  title?: string;
  body?: string;
  publishedAt?: string;
  expiresAt?: string | null;
};

/** GET /system-announcements/admin */
export async function listAdminSystemAnnouncementsRequest(
  accessToken: string,
  options: { includeExpired?: boolean; includeDeleted?: boolean; limit?: number } = {},
): Promise<{ items: SystemAnnouncementAdmin[]; total: number }> {
  const params = new URLSearchParams();
  if (options.includeExpired) params.set("includeExpired", "true");
  if (options.includeDeleted) params.set("includeDeleted", "true");
  params.set("limit", String(options.limit ?? 50));
  const res = await fetch(
    `/api/v1/system-announcements/admin?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as { items: SystemAnnouncementAdmin[]; total: number };
}

/** POST /system-announcements/admin */
export async function createSystemAnnouncementRequest(
  accessToken: string,
  payload: SystemAnnouncementWriteBody & {
    kind: SystemAnnouncementKind;
    title: string;
    body: string;
  },
): Promise<SystemAnnouncementAdmin> {
  const res = await fetch(`/api/v1/system-announcements/admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as SystemAnnouncementAdmin;
}

/** PATCH /system-announcements/admin/:id */
export async function updateSystemAnnouncementRequest(
  accessToken: string,
  id: string,
  payload: SystemAnnouncementWriteBody,
): Promise<SystemAnnouncementAdmin> {
  const res = await fetch(`/api/v1/system-announcements/admin/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as SystemAnnouncementAdmin;
}

/** DELETE /system-announcements/admin/:id */
export async function deleteSystemAnnouncementRequest(
  accessToken: string,
  id: string,
): Promise<SystemAnnouncementAdmin> {
  const res = await fetch(`/api/v1/system-announcements/admin/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as SystemAnnouncementAdmin;
}
