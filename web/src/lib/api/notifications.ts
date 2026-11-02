import { ApiError, type ApiErrorBody } from "./auth";

/** Días de aviso permitidos (API). */
export const ALLOWED_EXPIRY_NOTICE_DAYS = [30, 25, 15, 10] as const;

/** Defaults locales si falla la carga. */
export const DEFAULT_EXPIRY_NOTIFICATION_SETTINGS: ExpiryNotificationSettings = {
  courseCrewDays: [30, 25, 15, 10],
  courseAdminDays: [30, 25, 15, 10],
  boardingBookCrewDays: [30, 25, 15, 10],
  boardingBookAdminDays: [30, 25, 15, 10],
  courseExpiredCrewRepeatDays: 7,
  courseExpiredCrewMaxReminders: 4,
};

/** Opciones UI: cada cuántos días recordar curso vencido. */
export const COURSE_EXPIRED_REPEAT_DAY_OPTIONS = [0, 7, 14, 30] as const;
/** Tope de recordatorios al tripulante. */
export const COURSE_EXPIRED_MAX_REMINDER_OPTIONS = [1, 2, 3, 4, 6, 8] as const;

/** Settings de hitos de vencimiento. */
export type ExpiryNotificationSettings = {
  courseCrewDays: number[];
  courseAdminDays: number[];
  boardingBookCrewDays: number[];
  boardingBookAdminDays: number[];
  courseExpiredCrewRepeatDays: number;
  courseExpiredCrewMaxReminders: number;
};

/** Tipos de fila del outbox. */
export type NotificationOutboxType =
  | "boarding_book_expiring"
  | "course_expiring"
  | "course_expired"
  | "boarding_book_admin_digest"
  | "course_admin_digest";

/** Estados del worker. */
export type NotificationOutboxStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

/** Fila del outbox. */
export type NotificationOutboxItem = {
  id: string;
  legacyMongoId: string | null;
  type: NotificationOutboxType;
  dedupeKey: string;
  to: string;
  payload: unknown;
  status: NotificationOutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  lockedAt: string | null;
  sentAt: string | null;
  businessId: string | null;
  crewMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Listado paginado. */
export type ListNotificationOutboxResult = {
  items: NotificationOutboxItem[];
  total: number;
  page: number;
  limit: number;
};

/** Query del listado. */
export type ListNotificationOutboxQuery = {
  page?: number;
  limit?: number;
  status?: NotificationOutboxStatus;
  type?: NotificationOutboxType;
  search?: string;
  businessId?: string;
};

/** Resultado del generador. */
export type ProcessCourseExpiryResult = {
  expiringRows: number;
  expiringEmails: number;
  expiredEmails: number;
  adminEmails: number;
  skippedCrewWithoutEmail: number;
  statusesSynced: number;
  warningDays: number;
};

/** Resultado del worker. */
export type ProcessOutboxResult = {
  recovered: number;
  sent: number;
  failed: number;
  cancelled: number;
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

/** GET /notification-settings/expiry */
export async function getExpiryNotificationSettingsRequest(
  accessToken: string,
): Promise<ExpiryNotificationSettings> {
  const res = await fetch("/api/v1/notification-settings/expiry", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ExpiryNotificationSettings;
}

/** PUT /notification-settings/expiry */
export async function updateExpiryNotificationSettingsRequest(
  accessToken: string,
  settings: Partial<ExpiryNotificationSettings>,
): Promise<ExpiryNotificationSettings> {
  const res = await fetch("/api/v1/notification-settings/expiry", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ExpiryNotificationSettings;
}

/** GET /notification-outbox */
export async function listNotificationOutboxRequest(
  accessToken: string,
  query: ListNotificationOutboxQuery = {},
): Promise<ListNotificationOutboxResult> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 30));
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.businessId) params.set("businessId", query.businessId);

  const res = await fetch(`/api/v1/notification-outbox?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ListNotificationOutboxResult;
}

/** POST /notification-outbox/:id/retry */
export async function retryNotificationOutboxRequest(
  accessToken: string,
  id: string,
): Promise<NotificationOutboxItem> {
  const res = await fetch(`/api/v1/notification-outbox/${id}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as NotificationOutboxItem;
}

/** POST /notification-outbox/run-course-expiry */
export async function runCourseExpiryRequest(
  accessToken: string,
): Promise<ProcessCourseExpiryResult> {
  const res = await fetch("/api/v1/notification-outbox/run-course-expiry", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ProcessCourseExpiryResult;
}

/** POST /notification-outbox/process?limit= */
export async function processOutboxRequest(
  accessToken: string,
  limit = 10,
): Promise<ProcessOutboxResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/v1/notification-outbox/process?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as ProcessOutboxResult;
}
