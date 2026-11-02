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

export const getDashboardSummaryResponseSchema = z
  .object({
    kpis: dashboardKpiSchema,
    upcoming: z.array(dashboardUpcomingItemSchema),
  })
  .openapi("DashboardSummaryResponse");

/** Query GET /dashboard/summary. */
export const getDashboardSummaryQuerySchema = z.object({
  /** Tope de filas en “próximos vencimientos”. */
  upcomingLimit: z.coerce.number().int().positive().max(50).default(10),
});

export const getDashboardSummaryRequestSchema = z.object({
  query: getDashboardSummaryQuerySchema,
});

export type GetDashboardSummaryQuery = z.infer<
  typeof getDashboardSummaryQuerySchema
>;
