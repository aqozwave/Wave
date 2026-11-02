import { getDateOnlyKey } from "../../lib/dateOnly.js";
import { daysUntilExpiry } from "../../lib/crewCourseStatus.js";
import { prisma } from "../../lib/prisma.js";
import {
  getExpiryNotificationSettings,
  getMaxWarningDays,
} from "../notificationSettings/notificationSettings.service.js";
import { listExpiryDigestRecipients } from "../roles/roles.service.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Cursor diario: evita más de un digest admin de libreta por día. */
const ADMIN_DIGEST_STATE_KEY = "boarding_book_expiry_admin_digest";

/** Resultado del ciclo de generación de libreta. */
export type ProcessBoardingBookExpiryResult = {
  expiringRows: number;
  expiringEmails: number;
  adminEmails: number;
  skippedCrewWithoutEmail: number;
  warningDays: number;
};

/** Fila del digest admin (solo por vencer; el portal viejo no avisa vencidas). */
type DigestRow = {
  crewName: string;
  crewRun: string;
  validUntil: string;
  businessId: string | null;
  daysLeft: number;
};

/** Warning days por defecto si settings no trae hitos (igual portal viejo). */
function getBoardingBookWarningDaysFallback(): number {
  const fromEnv = Number.parseInt(
    process.env.BOARDING_BOOK_DAYS_TO_NOTIFY ?? "",
    10,
  );
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 10;
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

/** ¿Ya se marcó el digest admin de libreta para el día de `now`? */
async function wasAdminDigestSentToday(now: Date): Promise<boolean> {
  const todayKey = getDateOnlyKey(now);
  if (todayKey == null) return false;
  const row = await prisma.systemSetting.findUnique({
    where: { key: ADMIN_DIGEST_STATE_KEY },
  });
  return row?.value === todayKey;
}

/** Persiste el cursor diario del digest admin de libreta. */
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
 * Genera filas en el outbox para libretas por vencer + digest admin.
 * No envía correos (eso es el worker). Idempotente vía dedupeKey.
 * Igual que el portal viejo: no genera avisos de libreta ya vencida.
 */
export async function processBoardingBookExpiryNotifications(options?: {
  now?: Date;
}): Promise<ProcessBoardingBookExpiryResult> {
  const now = options?.now ?? new Date();
  const settings = await getExpiryNotificationSettings();
  const warningDays =
    getMaxWarningDays(settings, "boardingBookCrewDays") ||
    getBoardingBookWarningDaysFallback();

  const crews = await prisma.crewMember.findMany({
    where: {
      deletedAt: null,
      state: true,
    },
  });

  const digestRows: DigestRow[] = [];
  let expiringEmails = 0;
  let adminEmails = 0;
  let skippedCrewWithoutEmail = 0;

  for (const crew of crews) {
    const daysLeft = daysUntilExpiry(crew.boardingBookValidUntil, now);
    // Vencida o sin fecha usable → no avisar (mismo criterio portal viejo).
    if (daysLeft == null || daysLeft < 0) continue;

    const crewName = formatPersonName(crew);
    const email = await resolveCrewEmail(crew);
    const validUntilIso = crew.boardingBookValidUntil.toISOString();
    const validUntilKey = getDateOnlyKey(crew.boardingBookValidUntil);

    if (settings.boardingBookAdminDays.includes(daysLeft)) {
      digestRows.push({
        crewName,
        crewRun: crew.run ?? "",
        validUntil: validUntilIso,
        businessId: crew.businessId,
        daysLeft,
      });
    }

    if (!settings.boardingBookCrewDays.includes(daysLeft)) {
      continue;
    }

    if (!email) {
      skippedCrewWithoutEmail += 1;
      continue;
    }

    const dedupeKey = `boarding_book_expiring:${crew.id}:${validUntilKey}:${daysLeft}`;

    try {
      const { inserted } = await enqueueNotification({
        type: "boarding_book_expiring",
        dedupeKey,
        to: email,
        payload: {
          crewMemberId: crew.id,
          crewName,
          validUntil: validUntilIso,
          validUntilKey,
          daysLeft,
          warningDays,
        },
        businessId: crew.businessId,
        crewMemberId: crew.id,
      });

      if (inserted) expiringEmails += 1;
    } catch (error) {
      console.error("Error encolando aviso de libreta por vencer", {
        crewMemberId: crew.id,
        error: error instanceof Error ? error.message : String(error),
      });
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
          type: "boarding_book_admin_digest",
          dedupeKey: `boarding_book_admin_digest:${recipient.id}:${todayKey}`,
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
        console.error("Error encolando resumen admin de libretas", {
          adminEmail: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (digestTargets > 0 && digestOk === digestTargets) {
      await markAdminDigestSentToday(now);
    }
  }

  const result: ProcessBoardingBookExpiryResult = {
    expiringRows: digestRows.length,
    expiringEmails,
    adminEmails,
    skippedCrewWithoutEmail,
    warningDays,
  };

  console.info("Notificaciones de vigencia de libreta procesadas", result);
  return result;
}
