import { prisma } from "../../lib/prisma.js";
import { computeCourseCompliancePercents } from "../crewMemberCourses/crewMemberCourses.service.js";

/** Meses cortos es-CL para el eje X del chart. */
const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

/** Cuántos meses hacia atrás incluye el chart (incluye el mes actual). */
export const MONTHLY_COMPLIANCE_MONTHS = 12;

/** Punto del chart «Cumplimiento mensual». */
export type MonthlyCompliancePoint = {
  /** YYYY-MM (mes UTC). */
  periodMonth: string;
  /** Etiqueta corta (Ene, Feb, …). */
  label: string;
  /** Promedio 0–100; null si aún no hay snapshot. */
  percent: number | null;
};

/**
 * Primer día del mes en UTC (Date a medianoche).
 */
export function startOfUtcMonth(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

/** YYYY-MM desde un Date (UTC). */
function toYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Lista de los últimos `count` meses (más antiguo → más reciente). */
function lastMonthStarts(count: number, now = new Date()): Date[] {
  const current = startOfUtcMonth(now);
  const out: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(
      new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth() - i,
          1,
          0,
          0,
          0,
          0,
        ),
      ),
    );
  }
  return out;
}

/**
 * Calcula % cumplimiento promedio de tripulantes activos bajo un filtro.
 */
async function computeComplianceForWhere(where: {
  businessId?: string;
  /** Si viene, acota a esa nave (CrewMember.locationId es obligatorio). */
  locationId?: string;
}): Promise<{ compliancePercent: number | null; crewCount: number }> {
  const crews = await prisma.crewMember.findMany({
    where: {
      deletedAt: null,
      state: true,
      ...(where.businessId ? { businessId: where.businessId } : {}),
      ...(where.locationId ? { locationId: where.locationId } : {}),
    },
    select: {
      id: true,
      competencyCertificateId: true,
    },
  });

  const complianceMap = await computeCourseCompliancePercents(crews);
  const values: number[] = [];
  for (const crew of crews) {
    const pct = complianceMap.get(crew.id);
    if (typeof pct === "number") values.push(pct);
  }

  return {
    crewCount: crews.length,
    compliancePercent:
      values.length === 0
        ? null
        : Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

/**
 * Upsert de un snapshot (empresa o nave) para un mes.
 * Sin unique Prisma por null: findFirst + create/update.
 */
export async function upsertComplianceSnapshot(input: {
  businessId: string;
  locationId: string | null;
  periodMonth: Date;
  compliancePercent: number | null;
  crewCount: number;
}): Promise<void> {
  const periodMonth = startOfUtcMonth(input.periodMonth);
  const existing = await prisma.complianceSnapshot.findFirst({
    where: {
      businessId: input.businessId,
      locationId: input.locationId,
      periodMonth,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.complianceSnapshot.update({
      where: { id: existing.id },
      data: {
        compliancePercent: input.compliancePercent,
        crewCount: input.crewCount,
      },
    });
    return;
  }

  await prisma.complianceSnapshot.create({
    data: {
      businessId: input.businessId,
      locationId: input.locationId,
      periodMonth,
      compliancePercent: input.compliancePercent,
      crewCount: input.crewCount,
    },
  });
}

/**
 * Calcula y guarda el snapshot del mes actual para una empresa
 * (rollup) y, si viene, para una nave concreta.
 */
export async function captureCurrentComplianceSnapshot(input: {
  businessId: string;
  locationId?: string | null;
}): Promise<void> {
  const periodMonth = startOfUtcMonth();

  // Rollup empresa (siempre, para el chart sin filtro de nave).
  const businessAgg = await computeComplianceForWhere({
    businessId: input.businessId,
  });
  await upsertComplianceSnapshot({
    businessId: input.businessId,
    locationId: null,
    periodMonth,
    compliancePercent: businessAgg.compliancePercent,
    crewCount: businessAgg.crewCount,
  });

  if (input.locationId) {
    const vesselAgg = await computeComplianceForWhere({
      businessId: input.businessId,
      locationId: input.locationId,
    });
    await upsertComplianceSnapshot({
      businessId: input.businessId,
      locationId: input.locationId,
      periodMonth,
      compliancePercent: vesselAgg.compliancePercent,
      crewCount: vesselAgg.crewCount,
    });
  }
}

/**
 * Job: snapshot del mes actual para todas las empresas activas
 * + cada nave (location vessel o null) con tripulación.
 */
export async function runComplianceSnapshotsForAllBusinesses(): Promise<{
  businesses: number;
  vessels: number;
}> {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null, state: true },
    select: { id: true },
  });

  let vesselWrites = 0;
  for (const biz of businesses) {
    await captureCurrentComplianceSnapshot({ businessId: biz.id });

    const locations = await prisma.location.findMany({
      where: {
        businessId: biz.id,
        deletedAt: null,
        state: true,
        OR: [{ kind: "vessel" }, { kind: null }],
      },
      select: { id: true },
    });

    for (const loc of locations) {
      const agg = await computeComplianceForWhere({
        businessId: biz.id,
        locationId: loc.id,
      });
      // Sin tripulación no ensuciamos el chart de esa nave.
      if (agg.crewCount === 0) continue;
      await upsertComplianceSnapshot({
        businessId: biz.id,
        locationId: loc.id,
        periodMonth: startOfUtcMonth(),
        compliancePercent: agg.compliancePercent,
        crewCount: agg.crewCount,
      });
      vesselWrites += 1;
    }
  }

  return { businesses: businesses.length, vessels: vesselWrites };
}

/**
 * Serie de 12 meses para el Panel.
 * - locationId set → snapshots de esa nave
 * - businessId set, location null → rollup empresa
 * - global (sin business) → promedio ponderado de rollups empresa
 */
export async function listMonthlyCompliance(input: {
  kind: "global" | "business" | "location";
  businessId: string | null;
  locationId: string | null;
  months?: number;
  now?: Date;
}): Promise<MonthlyCompliancePoint[]> {
  const months = input.months ?? MONTHLY_COMPLIANCE_MONTHS;
  const now = input.now ?? new Date();
  const monthStarts = lastMonthStarts(months, now);
  const from = monthStarts[0]!;
  const to = monthStarts[monthStarts.length - 1]!;

  // Asegura el mes actual antes de leer (lazy write).
  if (input.kind === "location" && input.businessId && input.locationId) {
    await captureCurrentComplianceSnapshot({
      businessId: input.businessId,
      locationId: input.locationId,
    });
  } else if (input.kind === "business" && input.businessId) {
    await captureCurrentComplianceSnapshot({
      businessId: input.businessId,
    });
  } else if (input.kind === "global") {
    // Un pase liviano: solo rollups empresa del job; si no hay, captura todas.
    const bizIds = await prisma.business.findMany({
      where: { deletedAt: null, state: true },
      select: { id: true },
    });
    for (const b of bizIds) {
      await captureCurrentComplianceSnapshot({ businessId: b.id });
    }
  }

  if (input.kind === "global") {
    const rows = await prisma.complianceSnapshot.findMany({
      where: {
        locationId: null,
        periodMonth: { gte: from, lte: to },
      },
      select: {
        periodMonth: true,
        compliancePercent: true,
        crewCount: true,
      },
    });

    const byMonth = new Map<
      string,
      { weighted: number; weight: number; anyNull: boolean }
    >();
    for (const row of rows) {
      const key = toYearMonth(row.periodMonth);
      const bucket = byMonth.get(key) ?? {
        weighted: 0,
        weight: 0,
        anyNull: false,
      };
      if (row.compliancePercent == null || row.crewCount <= 0) {
        bucket.anyNull = bucket.anyNull || row.compliancePercent == null;
      } else {
        bucket.weighted += row.compliancePercent * row.crewCount;
        bucket.weight += row.crewCount;
      }
      byMonth.set(key, bucket);
    }

    return monthStarts.map((d) => {
      const key = toYearMonth(d);
      const bucket = byMonth.get(key);
      const percent =
        bucket && bucket.weight > 0
          ? Math.round(bucket.weighted / bucket.weight)
          : null;
      return {
        periodMonth: key,
        label: MONTH_LABELS_ES[d.getUTCMonth()]!,
        percent,
      };
    });
  }

  const rows = await prisma.complianceSnapshot.findMany({
    where: {
      businessId: input.businessId!,
      locationId: input.kind === "location" ? input.locationId : null,
      periodMonth: { gte: from, lte: to },
    },
    select: {
      periodMonth: true,
      compliancePercent: true,
    },
  });

  const byMonth = new Map<string, number | null>();
  for (const row of rows) {
    byMonth.set(toYearMonth(row.periodMonth), row.compliancePercent);
  }

  return monthStarts.map((d) => {
    const key = toYearMonth(d);
    return {
      periodMonth: key,
      label: MONTH_LABELS_ES[d.getUTCMonth()]!,
      percent: byMonth.has(key) ? (byMonth.get(key) ?? null) : null,
    };
  });
}
