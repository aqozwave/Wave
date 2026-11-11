import { getDateOnlyKey } from "../../lib/dateOnly.js";
import {
  daysUntilExpiry,
  getTrainingExpiryWarningDays,
  resolveTrainingAssignmentStatus,
} from "../../lib/crewTrainingStatus.js";
import { prisma } from "../../lib/prisma.js";
import {
  getExpiryNotificationSettings,
  getMaxWarningDays,
} from "../notificationSettings/notificationSettings.service.js";
import { listPreventionStaffRecipients } from "../roles/roles.service.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Cursor diario: un digest de capacitaciones por día calendario. */
const ADMIN_DIGEST_STATE_KEY = "training_expiry_admin_digest";

/** Resultado del ciclo de generación. */
export type ProcessTrainingExpiryResult = {
  expiringRows: number;
  expiringEmails: number;
  expiredEmails: number;
  adminEmails: number;
  skippedCrewWithoutEmail: number;
  statusesSynced: number;
  warningDays: number;
};

/** Fila del digest admin/prevencionista. */
type DigestRow = {
  crewName: string;
  crewRun: string;
  trainingName: string;
  expiresAt: string | null;
  businessId: string | null;
  daysLeft: number | null;
  kind: "expiring" | "expired";
  cycle?: number | null;
};

/**
 * Ciclo de recordatorio según días vencido.
 * Día 1 vencido → ciclo 0.
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

/** ¿Ya se marcó el digest de capacitaciones para el día de `now`? */
async function wasAdminDigestSentToday(now: Date): Promise<boolean> {
  const todayKey = getDateOnlyKey(now);
  if (todayKey == null) return false;
  const row = await prisma.systemSetting.findUnique({
    where: { key: ADMIN_DIGEST_STATE_KEY },
  });
  return row?.value === todayKey;
}

/** Persiste el cursor diario del digest. */
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
 * Recalcula status persistido de capacitaciones (mismo criterio que cursos).
 */
async function syncStaleTrainingStatuses(options: {
  warningDays: number;
  now: Date;
}): Promise<number> {
  const rows = await prisma.crewMemberTraining.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      status: true,
      completedAt: true,
      expiresAt: true,
    },
  });

  let synced = 0;
  for (const row of rows) {
    const nextStatus = resolveTrainingAssignmentStatus(row, {
      warningDays: options.warningDays,
      now: options.now,
    });
    if (nextStatus === row.status) continue;
    await prisma.crewMemberTraining.update({
      where: { id: row.id },
      data: { status: nextStatus },
    });
    synced += 1;
  }
  return synced;
}

/**
 * Genera filas en el outbox para capacitaciones por vencer / vencidas + digest.
 * Destinatarios digest: admin + prevencionista del tenant.
 * No envía correos (eso es el worker). Idempotente vía dedupeKey.
 */
export async function processTrainingExpiryNotifications(options?: {
  now?: Date;
}): Promise<ProcessTrainingExpiryResult> {
  const now = options?.now ?? new Date();
  const settings = await getExpiryNotificationSettings();
  const warningDays =
    getMaxWarningDays(settings, "trainingCrewDays") ||
    getTrainingExpiryWarningDays();

  const statusesSynced = await syncStaleTrainingStatuses({
    warningDays,
    now,
  });

  const assignments = await prisma.crewMemberTraining.findMany({
    where: { deletedAt: null },
  });

  const crewIds = [...new Set(assignments.map((row) => row.crewMemberId))];
  const trainingIds = [...new Set(assignments.map((row) => row.trainingId))];

  const [crews, trainings] = await Promise.all([
    prisma.crewMember.findMany({
      where: {
        id: { in: crewIds },
        deletedAt: null,
        state: true,
      },
    }),
    prisma.training.findMany({
      where: {
        id: { in: trainingIds },
        deletedAt: null,
      },
    }),
  ]);

  const crewMap = new Map(crews.map((crew) => [crew.id, crew]));
  const trainingMap = new Map(
    trainings.map((training) => [training.id, training]),
  );

  const digestRows: DigestRow[] = [];
  let expiringEmails = 0;
  let expiredEmails = 0;
  let adminEmails = 0;
  let skippedCrewWithoutEmail = 0;

  for (const assignment of assignments) {
    const crew = crewMap.get(assignment.crewMemberId);
    const training = trainingMap.get(assignment.trainingId);
    if (!crew || !training) continue;

    const crewName = formatPersonName(crew);
    const trainingName = training.name;
    const email = await resolveCrewEmail(crew);
    const daysLeft = daysUntilExpiry(assignment.expiresAt, now);
    const status = resolveTrainingAssignmentStatus(assignment, {
      warningDays,
      now,
    });

    if (
      daysLeft != null &&
      daysLeft >= 0 &&
      settings.trainingAdminDays.includes(daysLeft)
    ) {
      digestRows.push({
        crewName,
        crewRun: crew.run ?? "",
        trainingName,
        expiresAt: assignment.expiresAt
          ? assignment.expiresAt.toISOString()
          : null,
        businessId: crew.businessId,
        daysLeft,
        kind: "expiring",
      });
    }

    if (
      daysLeft != null &&
      daysLeft >= 0 &&
      settings.trainingCrewDays.includes(daysLeft)
    ) {
      const milestonesSent = assignment.expiringMilestonesSent ?? [];

      if (!email) {
        skippedCrewWithoutEmail += 1;
      } else if (!milestonesSent.includes(daysLeft)) {
        const expiresAtKey = getDateOnlyKey(assignment.expiresAt);
        const dedupeKey = `training_expiring:${assignment.id}:${expiresAtKey}:${daysLeft}`;

        try {
          const { inserted } = await enqueueNotification({
            type: "training_expiring",
            dedupeKey,
            to: email,
            payload: {
              assignmentId: assignment.id,
              crewName,
              trainingName,
              expiresAt: assignment.expiresAt
                ? assignment.expiresAt.toISOString()
                : null,
              expiresAtKey,
              daysLeft,
            },
            businessId: crew.businessId,
            crewMemberId: crew.id,
          });

          await prisma.crewMemberTraining.update({
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
          console.error("Error encolando aviso de capacitación por vencer", {
            assignmentId: assignment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (status === "expired") {
      const repeatDays = settings.trainingExpiredCrewRepeatDays;
      const maxReminders = settings.trainingExpiredCrewMaxReminders;
      const cycle = resolveExpiredReminderCycle(daysLeft, repeatDays);

      if (isExpiredReminderCycleDay(daysLeft, repeatDays)) {
        digestRows.push({
          crewName,
          crewRun: crew.run ?? "",
          trainingName,
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
        const dedupeKey = `training_expired:${assignment.id}:${expiresAtKey}:${cycle}`;

        try {
          const { inserted } = await enqueueNotification({
            type: "training_expired",
            dedupeKey,
            to: email,
            payload: {
              assignmentId: assignment.id,
              crewName,
              trainingName,
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
            await prisma.crewMemberTraining.update({
              where: { id: assignment.id },
              data: { lastExpiredEmailAt: now },
            });
          }
        } catch (error) {
          console.error("Error encolando aviso de capacitación vencida", {
            assignmentId: assignment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  if (digestRows.length && !(await wasAdminDigestSentToday(now))) {
    const todayKey = getDateOnlyKey(now);
    // Admin + prevencionista (no el permiso de digest de cursos).
    const recipients = await listPreventionStaffRecipients();

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
          type: "training_admin_digest",
          dedupeKey: `training_admin_digest:${recipient.id}:${todayKey}`,
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
        console.error("Error encolando resumen de capacitaciones", {
          adminEmail: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (digestTargets > 0 && digestOk === digestTargets) {
      await markAdminDigestSentToday(now);
    }
  }

  const result: ProcessTrainingExpiryResult = {
    expiringRows: digestRows.length,
    expiringEmails,
    expiredEmails,
    adminEmails,
    skippedCrewWithoutEmail,
    statusesSynced,
    warningDays,
  };

  console.info(
    "Notificaciones de caducidad de capacitaciones procesadas",
    result,
  );
  return result;
}
