import { ApiError, type ApiErrorBody } from "./auth";

/** Estado de fila en próximos vencimientos. */
export type DashboardExpiryStatus = "expired" | "expiring_soon" | "pending";

/** KPIs del Panel. */
export type DashboardKpis = {
  compliancePercent: number | null;
  expiringSoonCount: number;
  expiredOrMissingCount: number;
  horizonDays: number;
  crewCount: number;
};

/** Fila de próximos vencimientos. */
export type DashboardUpcomingItem = {
  assignmentId: string;
  crewMemberId: string;
  crewFirstName: string;
  crewLastName: string;
  crewRun: string;
  courseName: string;
  status: DashboardExpiryStatus;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
};

/** Respuesta GET /dashboard/summary. */
export type DashboardSummary = {
  kpis: DashboardKpis;
  upcoming: DashboardUpcomingItem[];
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

/** GET /dashboard/summary */
export async function getDashboardSummaryRequest(
  accessToken: string,
  upcomingLimit = 10,
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  params.set("upcomingLimit", String(upcomingLimit));
  const res = await fetch(`/api/v1/dashboard/summary?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as DashboardSummary;
}
