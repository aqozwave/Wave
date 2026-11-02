import type { CrewCourseStatus } from "@prisma/client";

/**
 * Días de anticipación para marcar expiring_soon.
 * Portal viejo: DAYS_TO_NOTIFY (default 5).
 */
export function getCourseExpiryWarningDays(): number {
  const fromEnv = Number.parseInt(process.env.DAYS_TO_NOTIFY ?? "", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 5;
}

/** Medianoche UTC del día de una fecha (comparación date-only). */
function utcDayMs(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Recalcula el estado de una asignación según completedAt / expiresAt.
 * Misma lógica que el portal viejo (resolveAssignmentStatus).
 */
export function resolveAssignmentStatus(
  assignment: {
    completedAt?: Date | null;
    expiresAt?: Date | null;
    status?: CrewCourseStatus | null;
  } | null,
  options?: { warningDays?: number; now?: Date },
): CrewCourseStatus {
  if (!assignment) return "pending";

  const warningDays = options?.warningDays ?? getCourseExpiryWarningDays();
  const now = options?.now ?? new Date();

  if (!assignment.completedAt && assignment.status === "pending") {
    return "pending";
  }

  if (!assignment.expiresAt) {
    return assignment.completedAt ? "valid" : "pending";
  }

  const expiresDay = utcDayMs(assignment.expiresAt);
  const todayDay = utcDayMs(now);
  const diffDays = (expiresDay - todayDay) / 86_400_000;

  if (diffDays < 0) return "expired";
  if (diffDays <= warningDays) return "expiring_soon";
  return assignment.completedAt ? "valid" : "pending";
}

/** Días hasta el vencimiento (ceil); null si no hay expiresAt. */
export function daysUntilExpiry(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null;
  const diff = (utcDayMs(expiresAt) - utcDayMs(now)) / 86_400_000;
  return Math.ceil(diff);
}
