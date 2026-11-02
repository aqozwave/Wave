import {
  daysUntilExpiry,
  getCourseExpiryWarningDays,
  resolveAssignmentStatus,
} from "../../lib/crewCourseStatus.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { computeCourseCompliancePercents } from "../crewMemberCourses/crewMemberCourses.service.js";
import {
  getExpiryNotificationSettings,
  getMaxWarningDays,
} from "../notificationSettings/notificationSettings.service.js";
import type { GetDashboardSummaryQuery } from "./dashboard.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/**
 * Horizonte del KPI “Vencen en N días” del Panel Figma (60).
 * Independiente de courseCrewDays (avisos); el Panel pide 60 fijo.
 */
const DASHBOARD_HORIZON_DAYS = 60;

/**
 * Resumen del Panel: KPIs + próximos vencimientos de cursos.
 * Tenant: superadmin ve todo; resto solo su empresa.
 */
export async function getDashboardSummary(
  actor: Actor,
  query: GetDashboardSummaryQuery,
): Promise<{
  kpis: {
    compliancePercent: number | null;
    expiringSoonCount: number;
    expiredOrMissingCount: number;
    horizonDays: number;
    crewCount: number;
  };
  upcoming: Array<{
    assignmentId: string;
    crewMemberId: string;
    crewFirstName: string;
    crewLastName: string;
    crewRun: string;
    courseName: string;
    status: "expired" | "expiring_soon" | "pending";
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  }>;
}> {
  const crewWhere: {
    deletedAt: null;
    state: boolean;
    businessId?: string;
  } = { deletedAt: null, state: true };

  if (actor.internalRol === "superadmin") {
    // Sin filtro de empresa: visión global.
  } else {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    crewWhere.businessId = actor.businessId;
  }

  const crews = await prisma.crewMember.findMany({
    where: crewWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      run: true,
      competencyCertificateId: true,
    },
  });

  const complianceMap = await computeCourseCompliancePercents(crews);
  const complianceValues: number[] = [];
  for (const crew of crews) {
    const pct = complianceMap.get(crew.id);
    if (typeof pct === "number") complianceValues.push(pct);
  }
  const compliancePercent =
    complianceValues.length === 0
      ? null
      : Math.round(
          complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length,
        );

  const settings = await getExpiryNotificationSettings();
  const warningDays =
    getMaxWarningDays(settings, "courseCrewDays") ||
    getCourseExpiryWarningDays();
  const now = new Date();

  const crewIds = crews.map((c) => c.id);
  const assignments =
    crewIds.length === 0
      ? []
      : await prisma.crewMemberCourse.findMany({
          where: { crewMemberId: { in: crewIds }, deletedAt: null },
          include: {
            course: { select: { name: true, isMandatory: true, deletedAt: true } },
          },
          orderBy: [{ expiresAt: "asc" }],
        });

  const crewById = new Map(crews.map((c) => [c.id, c]));

  let expiringSoonCount = 0;
  let expiredOrMissingCount = 0;
  const upcomingCandidates: Array<{
    assignmentId: string;
    crewMemberId: string;
    crewFirstName: string;
    crewLastName: string;
    crewRun: string;
    courseName: string;
    status: "expired" | "expiring_soon" | "pending";
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    sortKey: number;
  }> = [];

  for (const row of assignments) {
    if (row.course?.deletedAt) continue;
    const status = resolveAssignmentStatus(row, { warningDays, now });
    const isMandatory = row.course?.isMandatory !== false;
    const days = daysUntilExpiry(row.expiresAt, now);
    const crew = crewById.get(row.crewMemberId);
    if (!crew) continue;

    if (status === "expired" || (isMandatory && status === "pending")) {
      expiredOrMissingCount += 1;
    }

    // Por vencer dentro del horizonte del Panel (aún no vencido).
    if (
      status !== "expired" &&
      status !== "pending" &&
      days != null &&
      days >= 0 &&
      days <= DASHBOARD_HORIZON_DAYS
    ) {
      expiringSoonCount += 1;
    }

    // En la tabla: vencidos, por vencer (warningDays o horizonte Panel) y faltantes obligatorios.
    const inHorizon =
      status === "valid" &&
      days != null &&
      days >= 0 &&
      days <= DASHBOARD_HORIZON_DAYS;
    if (
      status === "expired" ||
      status === "expiring_soon" ||
      inHorizon ||
      (isMandatory && status === "pending")
    ) {
      const panelStatus: "expired" | "expiring_soon" | "pending" =
        status === "expired"
          ? "expired"
          : status === "pending"
            ? "pending"
            : "expiring_soon";
      upcomingCandidates.push({
        assignmentId: row.id,
        crewMemberId: row.crewMemberId,
        crewFirstName: crew.firstName,
        crewLastName: crew.lastName,
        crewRun: crew.run,
        courseName: row.course?.name ?? "—",
        status: panelStatus,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        daysUntilExpiry: days,
        // Pendientes sin fecha al final; resto por días hasta vencer.
        sortKey: days == null ? Number.POSITIVE_INFINITY : days,
      });
    }
  }

  upcomingCandidates.sort((a, b) => a.sortKey - b.sortKey);
  const upcoming = upcomingCandidates
    .slice(0, query.upcomingLimit)
    .map(({ sortKey: _s, ...rest }) => rest);

  return {
    kpis: {
      compliancePercent,
      expiringSoonCount,
      expiredOrMissingCount,
      horizonDays: DASHBOARD_HORIZON_DAYS,
      crewCount: crews.length,
    },
    upcoming,
  };
}
