import type { CrewTrainingStatus } from "@prisma/client";
import {
  daysUntilExpiry,
  getCourseExpiryWarningDays,
  resolveAssignmentStatus,
} from "./crewCourseStatus.js";

/**
 * Días de anticipación para expiring_soon en capacitaciones.
 * Reusa DAYS_TO_NOTIFY (misma ventana que cursos OMI).
 */
export function getTrainingExpiryWarningDays(): number {
  return getCourseExpiryWarningDays();
}

/**
 * Recalcula status de una asignación de capacitación.
 * Misma regla que cursos; tipado con CrewTrainingStatus.
 */
export function resolveTrainingAssignmentStatus(
  assignment: {
    completedAt?: Date | null;
    expiresAt?: Date | null;
    status?: CrewTrainingStatus | null;
  } | null,
  options?: { warningDays?: number; now?: Date },
): CrewTrainingStatus {
  return resolveAssignmentStatus(assignment, options) as CrewTrainingStatus;
}

export { daysUntilExpiry };
