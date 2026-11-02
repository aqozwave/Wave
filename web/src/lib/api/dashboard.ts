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

/** Columna de cápsulas (Por nave / Por curso). */
export type DashboardCapsuleColumn = {
  id: string;
  label: string;
  name: string;
  soft: number;
  solid: number;
};

/** Cumplimiento agregado por nave. */
export type DashboardVesselCompliance = {
  locationId: string;
  name: string;
  crewCount: number;
  compliantCrewCount: number;
  compliancePercent: number | null;
};

/** Respuesta GET /dashboard/summary. */
export type DashboardSummary = {
  kpis: DashboardKpis;
  upcoming: DashboardUpcomingItem[];
  byVessel: DashboardCapsuleColumn[];
  byCourse: DashboardCapsuleColumn[];
  vessels: DashboardVesselCompliance[];
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
  options: {
    upcomingLimit?: number;
    vesselChartLimit?: number;
    courseChartLimit?: number;
    vesselListLimit?: number;
  } = {},
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  params.set("upcomingLimit", String(options.upcomingLimit ?? 10));
  params.set("vesselChartLimit", String(options.vesselChartLimit ?? 5));
  params.set("courseChartLimit", String(options.courseChartLimit ?? 5));
  params.set("vesselListLimit", String(options.vesselListLimit ?? 8));
  const res = await fetch(`/api/v1/dashboard/summary?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, body);
  return body as DashboardSummary;
}
