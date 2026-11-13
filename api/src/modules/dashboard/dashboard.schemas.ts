import { z } from "../../lib/zod.js";

/** Estado de un vencimiento en el panel. */
export const dashboardExpiryStatusSchema = z.enum([
  "expired",
  "expiring_soon",
  "pending",
]);

/**
 * Variación vs periodo previo (mes anterior vía ComplianceSnapshot).
 * null = sin snapshot previo o KPI sin histórico (conteos).
 */
export const dashboardKpiDeltasSchema = z
  .object({
    /**
     * Puntos porcentuales: cumplimiento actual − mes anterior.
     * Positivo = mejoró; negativo = bajó.
     */
    compliancePercentPoints: z.number().int().nullable(),
    /**
     * Diferencia de “por vencer”; null hasta que el snapshot guarde conteos.
     */
    expiringSoonCount: z.number().int().nullable(),
    /**
     * Diferencia de “vencidos/faltantes”; null hasta snapshot de conteos.
     */
    expiredOrMissingCount: z.number().int().nullable(),
    /** Etiqueta fija del periodo de comparación. */
    comparedTo: z.literal("previous_month"),
  })
  .openapi("DashboardKpiDeltas");

/** KPI superior del Panel. */
export const dashboardKpiSchema = z
  .object({
    /** Cumplimiento global 0–100; null si no hay cursos obligatorios. */
    compliancePercent: z.number().int().min(0).max(100).nullable(),
    /** Cursos que vencen dentro de la ventana (días). */
    expiringSoonCount: z.number().int().nonnegative(),
    /** Vencidos + pendientes obligatorios. */
    expiredOrMissingCount: z.number().int().nonnegative(),
    /** Ventana en días usada para “por vencer” (Panel Figma: 60). */
    horizonDays: z.number().int().positive(),
    /** Tripulantes activos considerados en el cálculo. */
    crewCount: z.number().int().nonnegative(),
    /** Variación vs mes anterior (cumplimiento desde snapshots). */
    deltas: dashboardKpiDeltasSchema,
  })
  .openapi("DashboardKpis");

/** Fila de la tabla “próximos vencimientos”. */
export const dashboardUpcomingItemSchema = z
  .object({
    assignmentId: z.uuid(),
    crewMemberId: z.uuid(),
    crewFirstName: z.string(),
    crewLastName: z.string(),
    crewRun: z.string(),
    courseName: z.string(),
    status: dashboardExpiryStatusSchema,
    expiresAt: z.string().datetime().nullable(),
    daysUntilExpiry: z.number().int().nullable(),
  })
  .openapi("DashboardUpcomingItem");

/**
 * Columna del chart de cápsulas (Por nave / Por curso).
 * soft = vencen en 31–60 d; solid = vencen en 0–30 d.
 */
export const dashboardCapsuleColumnSchema = z
  .object({
    /** Id de la entidad (location o course). */
    id: z.uuid(),
    /** Etiqueta corta del eje X (abreviación). */
    label: z.string().min(1).max(12),
    /** Nombre completo (tooltip / accesibilidad). */
    name: z.string(),
    /** Cantidad de cursos que vencen en 31–60 días. */
    soft: z.number().int().nonnegative(),
    /** Cantidad de cursos que vencen en 0–30 días. */
    solid: z.number().int().nonnegative(),
  })
  .openapi("DashboardCapsuleColumn");

/** Fila de la lista “Cumplimiento por nave”. */
export const dashboardVesselComplianceSchema = z
  .object({
    locationId: z.uuid(),
    name: z.string(),
    /** Tripulantes activos en la nave. */
    crewCount: z.number().int().nonnegative(),
    /** Tripulantes con cumplimiento 100 % (cursos obligatorios al día). */
    compliantCrewCount: z.number().int().nonnegative(),
    /** Promedio de cumplimiento 0–100; null si nadie tiene cursos obligatorios. */
    compliancePercent: z.number().int().min(0).max(100).nullable(),
    /** Sesiones de capacitación Prevención cerradas en esa nave. */
    completedTrainingSessionsCount: z.number().int().nonnegative(),
  })
  .openapi("DashboardVesselCompliance");

/** Alcance efectivo del resumen (alineado a rol / Figma S1·D1·C1). */
export const dashboardScopeSchema = z
  .object({
    kind: z.enum(["global", "business", "location"]),
    /** Nombre de la nave cuando kind = location. */
    locationId: z.uuid().nullable(),
    locationName: z.string().nullable(),
  })
  .openapi("DashboardScope");

/** Punto del chart «Cumplimiento mensual» (últimos 12 meses). */
export const dashboardMonthlyCompliancePointSchema = z
  .object({
    /** YYYY-MM (UTC). */
    periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
    /** Etiqueta corta es-CL (Ene, Feb, …). */
    label: z.string().min(1).max(3),
    /** Promedio 0–100; null si aún no hay snapshot ese mes. */
    percent: z.number().int().min(0).max(100).nullable(),
  })
  .openapi("DashboardMonthlyCompliancePoint");

export const getDashboardSummaryResponseSchema = z
  .object({
    scope: dashboardScopeSchema,
    kpis: dashboardKpiSchema,
    upcoming: z.array(dashboardUpcomingItemSchema),
    /** Top naves por cursos por vencer (cápsulas). */
    byVessel: z.array(dashboardCapsuleColumnSchema),
    /** Top cursos por vencimientos (cápsulas). */
    byCourse: z.array(dashboardCapsuleColumnSchema),
    /** Lista de cumplimiento por nave (sidebar del Panel). */
    vessels: z.array(dashboardVesselComplianceSchema),
    /** Serie histórica del chart cumplimiento mensual. */
    monthlyCompliance: z.array(dashboardMonthlyCompliancePointSchema),
  })
  .openapi("DashboardSummaryResponse");

/** Query GET /dashboard/summary. */
export const getDashboardSummaryQuerySchema = z.object({
  /** Tope de filas en “próximos vencimientos”. */
  upcomingLimit: z.coerce.number().int().positive().max(50).default(10),
  /** Tope de columnas del chart “Por nave”. */
  vesselChartLimit: z.coerce.number().int().positive().max(20).default(5),
  /** Tope de columnas del chart “Por curso”. */
  courseChartLimit: z.coerce.number().int().positive().max(20).default(5),
  /** Tope de filas en “Cumplimiento por nave”. */
  vesselListLimit: z.coerce.number().int().positive().max(50).default(8),
  /**
   * Filtro opcional por embarcación (locationId).
   * Superadmin/admin: acota el resumen a esa nave.
   * Colaborador/user: solo se acepta su propia nave (o se ignora).
   */
  locationId: z.uuid().optional(),
});

export const getDashboardSummaryRequestSchema = z.object({
  query: getDashboardSummaryQuerySchema,
});

export type GetDashboardSummaryQuery = z.infer<
  typeof getDashboardSummaryQuerySchema
>;
