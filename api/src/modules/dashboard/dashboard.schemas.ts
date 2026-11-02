import { z } from "../../lib/zod.js";

/** Estado de un vencimiento en el panel. */
export const dashboardExpiryStatusSchema = z.enum([
  "expired",
  "expiring_soon",
  "pending",
]);

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
  })
  .openapi("DashboardVesselCompliance");

export const getDashboardSummaryResponseSchema = z
  .object({
    kpis: dashboardKpiSchema,
    upcoming: z.array(dashboardUpcomingItemSchema),
    /** Top naves por cursos por vencer (cápsulas). */
    byVessel: z.array(dashboardCapsuleColumnSchema),
    /** Top cursos por vencimientos (cápsulas). */
    byCourse: z.array(dashboardCapsuleColumnSchema),
    /** Lista de cumplimiento por nave (sidebar del Panel). */
    vessels: z.array(dashboardVesselComplianceSchema),
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
});

export const getDashboardSummaryRequestSchema = z.object({
  query: getDashboardSummaryQuerySchema,
});

export type GetDashboardSummaryQuery = z.infer<
  typeof getDashboardSummaryQuerySchema
>;
