import {
  daysUntilExpiry,
  getCourseExpiryWarningDays,
  resolveAssignmentStatus,
} from "../../lib/crewCourseStatus.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { isContractorPortalActor } from "../../lib/tenant.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { computeCourseCompliancePercents } from "../crewMemberCourses/crewMemberCourses.service.js";
import {
  getExpiryNotificationSettings,
  getMaxWarningDays,
} from "../notificationSettings/notificationSettings.service.js";
import type { GetDashboardSummaryQuery } from "./dashboard.schemas.js";
import {
  listMonthlyCompliance,
  type MonthlyCompliancePoint,
} from "./dashboardCompliance.service.js";

/** Actor mínimo tenant + alcance de nave (+ portal externo). */
type Actor = Pick<
  AuthUser,
  | "internalRol"
  | "businessId"
  | "locationId"
  | "dataScope"
  | "organizationId"
>;

/**
 * Horizonte del KPI “Vencen en N días” del Panel Figma (60).
 * Independiente de courseCrewDays (avisos); el Panel pide 60 fijo.
 */
const DASHBOARD_HORIZON_DAYS = 60;

/**
 * Resuelve el alcance del Panel según rol Figma:
 * S1 global · D1 empresa · C1 nave (location / colaborador / user).
 */
function resolveDashboardScope(actor: Actor): {
  kind: "global" | "business" | "location";
  locationId: string | null;
} {
  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    return { kind: "global", locationId: null };
  }
  const locationScoped =
    actor.dataScope === "location" ||
    actor.internalRol === "colaborador" ||
    actor.internalRol === "user";
  if (locationScoped && actor.locationId) {
    return { kind: "location", locationId: actor.locationId };
  }
  return { kind: "business", locationId: null };
}

/**
 * Umbral interno del bucket “urgente” (cápsula solid / 0–30 d).
 * soft = 31…horizon; solid = 0…este valor.
 */
const DASHBOARD_NEAR_DAYS = 30;

/** Acumulador de cápsulas por entidad (nave o curso). */
type CapsuleBucket = {
  id: string;
  name: string;
  soft: number;
  solid: number;
};

/**
 * Abreviación corta para el eje X del chart “Por nave”.
 * Prefiere la última palabra significativa (“Ronia Polaris” → “POL”).
 */
function vesselShortLabel(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(i|ii|iii|iv|de|la|el|los|las)$/i.test(p));
  const word =
    parts.length >= 2 ? parts[parts.length - 1]! : (parts[0] ?? name.trim());
  return word.slice(0, 3).toUpperCase() || "—";
}

/**
 * Abreviación corta para el eje X del chart “Por curso”.
 * Soporta “omi 1.39”, “1.13 Seguridad…” o las 3 primeras letras.
 */
function courseShortLabel(name: string): string {
  const trimmed = name.trim();
  // Catálogo migrado: "omi 1.39" → "1.39".
  const omi = trimmed.match(/^omi\s+([\d]+(?:\.[\d]+)*)/i);
  if (omi) return omi[1]!.slice(0, 8);
  const code = trimmed.match(/^[\d]+(?:\.[\d]+)*/);
  if (code) return code[0]!.slice(0, 8);
  return trimmed.slice(0, 3).toUpperCase() || "—";
}

/**
 * Ordena buckets por total soft+solid desc y recorta al límite.
 * Empate: nombre alfabético.
 */
function topCapsules(
  buckets: Map<string, CapsuleBucket>,
  limit: number,
  toLabel: (name: string) => string,
): Array<{
  id: string;
  label: string;
  name: string;
  soft: number;
  solid: number;
}> {
  return [...buckets.values()]
    .filter((b) => b.soft + b.solid > 0)
    .sort((a, b) => {
      const diff = b.soft + b.solid - (a.soft + a.solid);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "es");
    })
    .slice(0, limit)
    .map((b) => ({
      id: b.id,
      label: toLabel(b.name),
      name: b.name,
      soft: b.soft,
      solid: b.solid,
    }));
}

/**
 * Resumen del Panel: KPIs + próximos vencimientos + breakdowns por nave/curso.
 * Tenant: global (S1) · empresa (D1) · nave (C1).
 */
export async function getDashboardSummary(
  actor: Actor,
  query: GetDashboardSummaryQuery,
): Promise<{
  scope: {
    kind: "global" | "business" | "location";
    locationId: string | null;
    locationName: string | null;
  };
  kpis: {
    compliancePercent: number | null;
    expiringSoonCount: number;
    expiredOrMissingCount: number;
    horizonDays: number;
    crewCount: number;
    deltas: {
      compliancePercentPoints: number | null;
      expiringSoonCount: number | null;
      expiredOrMissingCount: number | null;
      comparedTo: "previous_month";
    };
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
  byVessel: Array<{
    id: string;
    label: string;
    name: string;
    soft: number;
    solid: number;
  }>;
  byCourse: Array<{
    id: string;
    label: string;
    name: string;
    soft: number;
    solid: number;
  }>;
  vessels: Array<{
    locationId: string;
    name: string;
    crewCount: number;
    compliantCrewCount: number;
    compliancePercent: number | null;
    completedTrainingSessionsCount: number;
  }>;
  monthlyCompliance: MonthlyCompliancePoint[];
}> {
  // Portal contratista: sin PII de tripulantes del panel interno.
  if (isContractorPortalActor(actor)) {
    throw new AppError(
      403,
      "forbidden",
      "El panel interno no está disponible para usuarios contratistas",
    );
  }

  const resolved = resolveDashboardScope(actor);
  const crewWhere: {
    deletedAt: null;
    state: boolean;
    businessId?: string;
    locationId?: string;
  } = { deletedAt: null, state: true };

  if (resolved.kind === "global") {
    // Sin filtro de empresa: visión global (S1).
  } else if (resolved.kind === "location") {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    if (!resolved.locationId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una nave asignada",
      );
    }
    crewWhere.businessId = actor.businessId;
    crewWhere.locationId = resolved.locationId;
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

  /**
   * Filtro UI “Embarcación”: acota global/empresa a una nave.
   * Rol ya location-scoped: solo admite su propia nave (defensa en profundidad).
   */
  let effectiveLocationId = resolved.locationId;
  let effectiveKind: "global" | "business" | "location" = resolved.kind;

  if (query.locationId) {
    if (resolved.kind === "location") {
      if (query.locationId !== resolved.locationId) {
        throw new AppError(
          403,
          "forbidden",
          "No podés filtrar por otra nave que la asignada",
        );
      }
    } else {
      const loc = await prisma.location.findFirst({
        where: { id: query.locationId, deletedAt: null },
        select: { id: true, name: true, businessId: true },
      });
      if (!loc) {
        throw new AppError(404, "location_not_found", "Embarcación no encontrada");
      }
      if (
        actor.internalRol !== "superadmin" &&
        actor.businessId &&
        loc.businessId !== actor.businessId
      ) {
        throw new AppError(404, "location_not_found", "Embarcación no encontrada");
      }
      crewWhere.locationId = loc.id;
      if (resolved.kind === "global") {
        // Superadmin filtrando una nave: también fija empresa vía location.
        crewWhere.businessId = loc.businessId;
      }
      effectiveLocationId = loc.id;
      effectiveKind = "location";
    }
  }

  let locationName: string | null = null;
  if (effectiveLocationId) {
    const loc = await prisma.location.findFirst({
      where: { id: effectiveLocationId, deletedAt: null },
      select: { name: true },
    });
    locationName = loc?.name ?? null;
  }

  const crews = await prisma.crewMember.findMany({
    where: crewWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      run: true,
      competencyCertificateId: true,
      locationId: true,
      location: {
        select: { id: true, name: true, kind: true, deletedAt: true, state: true },
      },
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
            course: {
              select: {
                id: true,
                name: true,
                isMandatory: true,
                deletedAt: true,
              },
            },
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

  /** Cápsulas por location (solo naves o sin clasificar con tripulación). */
  const vesselCapsules = new Map<string, CapsuleBucket>();
  /** Cápsulas por curso. */
  const courseCapsules = new Map<string, CapsuleBucket>();

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
    const inHorizonExpiring =
      status !== "expired" &&
      status !== "pending" &&
      days != null &&
      days >= 0 &&
      days <= DASHBOARD_HORIZON_DAYS;

    if (inHorizonExpiring) {
      expiringSoonCount += 1;

      // Bucket soft (31–60) vs solid (0–30) para charts.
      const isSolid = days! <= DASHBOARD_NEAR_DAYS;
      const loc = crew.location;
      const locOk =
        loc &&
        !loc.deletedAt &&
        loc.state !== false &&
        (loc.kind === "vessel" || loc.kind == null);
      if (locOk) {
        const vb = vesselCapsules.get(loc.id) ?? {
          id: loc.id,
          name: loc.name,
          soft: 0,
          solid: 0,
        };
        if (isSolid) vb.solid += 1;
        else vb.soft += 1;
        vesselCapsules.set(loc.id, vb);
      }

      if (row.course) {
        const cb = courseCapsules.get(row.course.id) ?? {
          id: row.course.id,
          name: row.course.name,
          soft: 0,
          solid: 0,
        };
        if (isSolid) cb.solid += 1;
        else cb.soft += 1;
        courseCapsules.set(row.course.id, cb);
      }
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

  const byVessel = topCapsules(
    vesselCapsules,
    query.vesselChartLimit,
    vesselShortLabel,
  );
  const byCourse = topCapsules(
    courseCapsules,
    query.courseChartLimit,
    courseShortLabel,
  );

  // Cumplimiento por nave: agrupa tripulantes activos en locations vessel/null.
  type VesselAgg = {
    locationId: string;
    name: string;
    crewCount: number;
    compliantCrewCount: number;
    pctSum: number;
    pctCount: number;
  };
  const vesselAggs = new Map<string, VesselAgg>();
  for (const crew of crews) {
    const loc = crew.location;
    if (!loc || loc.deletedAt || loc.state === false) continue;
    if (loc.kind !== "vessel" && loc.kind != null) continue;

    const agg = vesselAggs.get(loc.id) ?? {
      locationId: loc.id,
      name: loc.name,
      crewCount: 0,
      compliantCrewCount: 0,
      pctSum: 0,
      pctCount: 0,
    };
    agg.crewCount += 1;
    const pct = complianceMap.get(crew.id);
    if (typeof pct === "number") {
      agg.pctSum += pct;
      agg.pctCount += 1;
      if (pct === 100) agg.compliantCrewCount += 1;
    }
    vesselAggs.set(loc.id, agg);
  }

  // Sesiones Prevención cerradas por nave (mismo alcance de crewWhere).
  const sessionCountWhere: {
    deletedAt: null;
    status: "completed";
    businessId?: string;
    locationId?: string;
  } = { deletedAt: null, status: "completed" };
  if (crewWhere.businessId) sessionCountWhere.businessId = crewWhere.businessId;
  if (crewWhere.locationId) sessionCountWhere.locationId = crewWhere.locationId;

  const completedSessionGroups = await prisma.trainingSession.groupBy({
    by: ["locationId"],
    where: sessionCountWhere,
    _count: { _all: true },
  });
  const completedByLocation = new Map(
    completedSessionGroups.map((g) => [g.locationId, g._count._all]),
  );

  const vessels = [...vesselAggs.values()]
    .map((agg) => ({
      locationId: agg.locationId,
      name: agg.name,
      crewCount: agg.crewCount,
      compliantCrewCount: agg.compliantCrewCount,
      compliancePercent:
        agg.pctCount === 0
          ? null
          : Math.round(agg.pctSum / agg.pctCount),
      completedTrainingSessionsCount:
        completedByLocation.get(agg.locationId) ?? 0,
    }))
    // Peor cumplimiento primero; sin dato al final; empate por nombre.
    .sort((a, b) => {
      if (a.compliancePercent == null && b.compliancePercent == null) {
        return a.name.localeCompare(b.name, "es");
      }
      if (a.compliancePercent == null) return 1;
      if (b.compliancePercent == null) return -1;
      if (a.compliancePercent !== b.compliancePercent) {
        return a.compliancePercent - b.compliancePercent;
      }
      return a.name.localeCompare(b.name, "es");
    })
    .slice(0, query.vesselListLimit);

  // Serie del chart: nave si hay filtro/alcance C1; si no, empresa o global.
  const seriesBusinessId =
    typeof crewWhere.businessId === "string"
      ? crewWhere.businessId
      : actor.businessId;
  const monthlyCompliance = await listMonthlyCompliance({
    kind: effectiveKind,
    businessId: seriesBusinessId,
    locationId: effectiveLocationId,
  });

  // Delta de cumplimiento: actual vivo vs snapshot del mes anterior.
  // Conteos quedan null: ComplianceSnapshot aún no guarda expiring/expired.
  const previousMonthPoint =
    monthlyCompliance.length >= 2
      ? monthlyCompliance[monthlyCompliance.length - 2]
      : undefined;
  const compliancePercentPoints =
    compliancePercent != null &&
    previousMonthPoint != null &&
    previousMonthPoint.percent != null
      ? compliancePercent - previousMonthPoint.percent
      : null;

  return {
    scope: {
      kind: effectiveKind,
      locationId: effectiveLocationId,
      locationName,
    },
    kpis: {
      compliancePercent,
      expiringSoonCount,
      expiredOrMissingCount,
      horizonDays: DASHBOARD_HORIZON_DAYS,
      crewCount: crews.length,
      deltas: {
        compliancePercentPoints,
        expiringSoonCount: null,
        expiredOrMissingCount: null,
        comparedTo: "previous_month",
      },
    },
    upcoming,
    byVessel,
    byCourse,
    vessels,
    monthlyCompliance,
  };
}
