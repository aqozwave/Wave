import { getDateOnlyKey } from "../../lib/dateOnly.js";
import {
  daysUntilExpiry,
  getCourseExpiryWarningDays,
  resolveAssignmentStatus,
} from "../../lib/crewCourseStatus.js";
import { prisma } from "../../lib/prisma.js";
import { syncStaleAssignmentStatuses } from "../crewMemberCourses/crewMemberCourses.service.js";
import {
  getExpiryNotificationSettings,
  getMaxWarningDays,
} from "../notificationSettings/notificationSettings.service.js";
import { listExpiryDigestRecipients } from "../roles/roles.service.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Cursor diario: evita más de un digest admin por día calendario. */
const ADMIN_DIGEST_STATE_KEY = "course_expiry_admin_digest";

/** Resultado del ciclo de generación (métricas para log / Bruno). */
export type ProcessCourseExpiryResult = {
  expiringRows: number;
  expiringEmails: number;
  expiredEmails: number;
  adminEmails: number;
  skippedCrewWithoutEmail: number;
  statusesSynced: number;
  warningDays: number;
};

/** Fila del digest admin (expiring o expired en ciclo). */
type DigestRow = {
  crewName: string;
  crewRun: string;
  courseName: string;
  expiresAt: string | null;
  businessId: string | null;
  daysLeft: number | null;
  kind: "expiring" | "expired";
  cycle?: number | null;
};

/**
 * Ciclo de recordatorio según días vencido.
 * Día 1 vencido → ciclo 0. Con repeatDays=7: ciclos 0,1,2… en días 1,8,15…
 */
function resolveExpiredReminderCycle(
  daysUntilExpiryValue: number | null,
  repeatDays: number,
): number | null {
  if (repeatDays <= 0) return null;
  if (daysUntilExpiryValue == null || daysUntilExpiryValue >= 0) return null;
  const daysSinceExpiry = -daysUntilExpiryValue;
  return Math.floor((daysSinceExpiry - 1) / repeatDays);
}

/** ¿Hoy cae en un día de ciclo de recordatorio de vencido? */
function isExpiredReminderCycleDay(
  daysUntilExpiryValue: number | null,
  repeatDays: number,
): boolean {
  if (repeatDays <= 0) return false;
  if (daysUntilExpiryValue == null || daysUntilExpiryValue >= 0) return false;
  const daysSinceExpiry = -daysUntilExpiryValue;
  if (daysSinceExpiry < 1) return false;
  return (daysSinceExpiry - 1) % repeatDays === 0;
}

/** Nombre visible tripulante. */
function formatPersonName(crew: {
  firstName: string;
  lastName: string;
}): string {
  return `${crew.firstName} ${crew.lastName}`.trim();
}

/** Correo del tripulante o, si falta, el de su User vinculado. */
async function resolveCrewEmail(crew: {
  email: string;
  userId: string | null;
}): Promise<string | null> {
  if (crew.email?.trim()) return crew.email.trim().toLowerCase();
  if (!crew.userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: crew.userId, deletedAt: null },
    select: { email: true },
  });
  return user?.email?.trim().toLowerCase() || null;
}

/** ¿Ya se marcó el digest admin para el día calendario de `now`? */
async function wasAdminDigestSentToday(now: Date): Promise<boolean> {
  const todayKey = getDateOnlyKey(now);
  if (todayKey == null) return false;
  const row = await prisma.systemSetting.findUnique({
    where: { key: ADMIN_DIGEST_STATE_KEY },
  });
  return row?.value === todayKey;
}

/** Persiste el cursor diario del digest admin. */
async function markAdminDigestSentToday(now: Date): Promise<void> {
  const todayKey = getDateOnlyKey(now);
  if (todayKey == null) return;
  await prisma.systemSetting.upsert({
    where: { key: ADMIN_DIGEST_STATE_KEY },
    create: { key: ADMIN_DIGEST_STATE_KEY, value: todayKey },
    update: { value: todayKey },
  });
}

/**
 * Genera filas en el outbox para cursos por vencer / vencidos + digest admin.
 * No envía correos (eso es el worker). Idempotente vía dedupeKey.
 */
export async function processCourseExpiryNotifications(options?: {
  now?: Date;
}): Promise<ProcessCourseExpiryResult> {
  const now = options?.now ?? new Date();
  const settings = await getExpiryNotificationSettings();
  const warningDays =
    getMaxWarningDays(settings, "courseCrewDays") ||
    getCourseExpiryWarningDays();

  const statusesSynced = await syncStaleAssignmentStatuses({
    warningDays,
    now,
  });

  const assignments = await prisma.crewMemberCourse.findMany({
    where: { deletedAt: null },
  });

  const crewIds = [...new Set(assignments.map((row) => row.crewMemberId))];
  const courseIds = [...new Set(assignments.map((row) => row.courseId))];

  const [crews, courses] = await Promise.all([
    prisma.crewMember.findMany({
      where: {
        id: { in: crewIds },
        deletedAt: null,
        state: true,
      },
    }),
    prisma.course.findMany({
      where: {
        id: { in: courseIds },
        deletedAt: null,
      },
    }),
  ]);

  const crewMap = new Map(crews.map((crew) => [crew.id, crew]));
  const courseMap = new Map(courses.map((course) => [course.id, course]));

  const digestRows: DigestRow[] = [];
  let expiringEmails = 0;
  let expiredEmails = 0;
  let adminEmails = 0;
  let skippedCrewWithoutEmail = 0;

  for (const assignment of assignments) {
    const crew = crewMap.get(assignment.crewMemberId);
    const course = courseMap.get(assignment.courseId);
    if (!crew || !course) continue;

    const crewName = formatPersonName(crew);
    const courseName = course.name;
    const email = await resolveCrewEmail(crew);
    const daysLeft = daysUntilExpiry(assignment.expiresAt, now);
    const status = resolveAssignmentStatus(assignment, { warningDays, now });

    // Digest admin: hitos de courseAdminDays (aún no vencido).
    if (
      daysLeft != null &&
      daysLeft >= 0 &&
      settings.courseAdminDays.includes(daysLeft)
    ) {
      digestRows.push({
        crewName,
        crewRun: crew.run ?? "",
        courseName,
        expiresAt: assignment.expiresAt
          ? assignment.expiresAt.toISOString()
          : null,
        businessId: crew.businessId,
        daysLeft,
        kind: "expiring",
      });
    }

    // Mail tripulante: hitos de courseCrewDays (uno por hito vía milestones).
    if (
      daysLeft != null &&
      daysLeft >= 0 &&
      settings.courseCrewDays.includes(daysLeft)
    ) {
      const milestonesSent = assignment.expiringMilestonesSent ?? [];

      if (!email) {
        skippedCrewWithoutEmail += 1;
      } else if (!milestonesSent.includes(daysLeft)) {
        const expiresAtKey = getDateOnlyKey(assignment.expiresAt);
        const dedupeKey = `course_expiring:${assignment.id}:${expiresAtKey}:${daysLeft}`;

        try {
          const { inserted } = await enqueueNotification({
            type: "course_expiring",
            dedupeKey,
            to: email,
            payload: {
              assignmentId: assignment.id,
              crewName,
              courseName,
              expiresAt: assignment.expiresAt
                ? assignment.expiresAt.toISOString()
                : null,
              expiresAtKey,
              daysLeft,
            },
            businessId: crew.businessId,
            crewMemberId: crew.id,
          });

          await prisma.crewMemberCourse.update({
            where: { id: assignment.id },
            data: {
              expiringMilestonesSent: [
                ...new Set([...milestonesSent, daysLeft]),
              ],
              lastExpiringEmailAt: now,
            },
          });

          if (inserted) expiringEmails += 1;
        } catch (error) {
          console.error("Error encolando aviso de curso por vencer", {
            assignmentId: assignment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (status === "expired") {
      const repeatDays = settings.courseExpiredCrewRepeatDays;
      const maxReminders = settings.courseExpiredCrewMaxReminders;
      const cycle = resolveExpiredReminderCycle(daysLeft, repeatDays);

      if (isExpiredReminderCycleDay(daysLeft, repeatDays)) {
        digestRows.push({
          crewName,
          crewRun: crew.run ?? "",
          courseName,
          expiresAt: assignment.expiresAt
            ? assignment.expiresAt.toISOString()
            : null,
          businessId: crew.businessId,
          daysLeft,
          kind: "expired",
          cycle,
        });
      }

      if (cycle == null) {
        // repeatDays=0 o aún no aplica
      } else if (cycle >= maxReminders) {
        // tope al tripulante
      } else if (!email) {
        skippedCrewWithoutEmail += 1;
      } else {
        const expiresAtKey = getDateOnlyKey(assignment.expiresAt);
        const dedupeKey = `course_expired:${assignment.id}:${expiresAtKey}:${cycle}`;

        try {
          const { inserted } = await enqueueNotification({
            type: "course_expired",
            dedupeKey,
            to: email,
            payload: {
              assignmentId: assignment.id,
              crewName,
              courseName,
              expiresAt: assignment.expiresAt
                ? assignment.expiresAt.toISOString()
                : null,
              expiresAtKey,
              cycle,
            },
            businessId: crew.businessId,
            crewMemberId: crew.id,
          });

          if (inserted) {
            expiredEmails += 1;
            await prisma.crewMemberCourse.update({
              where: { id: assignment.id },
              data: { lastExpiredEmailAt: now },
            });
          }
        } catch (error) {
          console.error("Error encolando aviso de curso vencido", {
            assignmentId: assignment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  if (digestRows.length && !(await wasAdminDigestSentToday(now))) {
    const todayKey = getDateOnlyKey(now);
    // Destinatarios por permiso cursos.notifications.digest (Roles UI).
    const recipients = await listExpiryDigestRecipients();

    let digestTargets = 0;
    let digestOk = 0;

    for (const recipient of recipients) {
      const rows = recipient.seesAllBusinesses
        ? digestRows
        : digestRows.filter((row) => row.businessId === recipient.businessId);

      if (!rows.length) continue;

      digestTargets += 1;

      try {
        const { inserted } = await enqueueNotification({
          type: "course_admin_digest",
          dedupeKey: `course_admin_digest:${recipient.id}:${todayKey}`,
          to: recipient.email,
          payload: {
            digestDateKey: todayKey,
            rows,
          },
          businessId: recipient.seesAllBusinesses
            ? null
            : recipient.businessId,
          crewMemberId: null,
        });

        digestOk += 1;
        if (inserted) adminEmails += 1;
      } catch (error) {
        console.error("Error encolando resumen admin de cursos", {
          adminEmail: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (digestTargets > 0 && digestOk === digestTargets) {
      await markAdminDigestSentToday(now);
    }
  }

  const result: ProcessCourseExpiryResult = {
    expiringRows: digestRows.length,
    expiringEmails,
    expiredEmails,
    adminEmails,
    skippedCrewWithoutEmail,
    statusesSynced,
    warningDays,
  };

  console.info("Notificaciones de caducidad de cursos procesadas", result);
  return result;
}
