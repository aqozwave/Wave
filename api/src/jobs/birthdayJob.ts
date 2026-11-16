import { processBirthdayNotifications } from "../modules/notificationOutbox/birthdayNotification.service.js";
import { processOutbox } from "../modules/notificationOutbox/notificationOutboxWorker.service.js";

/** Zona horaria del disparo diario (Chile). */
const DEFAULT_TIMEZONE = "America/Santiago";
/** Hora local del disparo (08:00). */
const DEFAULT_HOUR = 8;
/** Minuto local del disparo. */
const DEFAULT_MINUTE = 0;

/** Partes de calendario en una zona (sin luxon). */
function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

/**
 * Ms hasta la próxima corrida diaria en `timeZone` a hour:minute.
 */
function msUntilNextDailyRun(
  timeZone: string,
  hour: number,
  minute: number,
  now = new Date(),
): number {
  const maxMinutes = 25 * 60;
  for (let m = 1; m <= maxMinutes; m += 1) {
    const probe = new Date(now.getTime() + m * 60_000);
    const parts = zonedParts(probe, timeZone);
    if (parts.hour === hour && parts.minute === minute) {
      return m * 60_000;
    }
  }
  return 24 * 60 * 60_000;
}

/** Lee timezone / hora / minuto del env (reusa claves de cursos o propias). */
function getSchedule(): {
  timeZone: string;
  hour: number;
  minute: number;
} {
  const timeZone =
    process.env.BIRTHDAY_JOB_TIMEZONE?.trim() ||
    process.env.COURSE_EXPIRY_JOB_TIMEZONE?.trim() ||
    DEFAULT_TIMEZONE;
  const hourRaw = Number.parseInt(
    process.env.BIRTHDAY_JOB_HOUR ?? process.env.COURSE_EXPIRY_JOB_HOUR ?? "",
    10,
  );
  const minuteRaw = Number.parseInt(
    process.env.BIRTHDAY_JOB_MINUTE ??
      process.env.COURSE_EXPIRY_JOB_MINUTE ??
      "",
    10,
  );
  const hour =
    Number.isFinite(hourRaw) && hourRaw >= 0 && hourRaw <= 23
      ? hourRaw
      : DEFAULT_HOUR;
  const minute =
    Number.isFinite(minuteRaw) && minuteRaw >= 0 && minuteRaw <= 59
      ? minuteRaw
      : DEFAULT_MINUTE;
  return { timeZone, hour, minute };
}

/**
 * Job diario: genera avisos de cumpleaños y procesa un lote del outbox.
 * Opt-in: solo corre con BIRTHDAY_NOTIFICATION_JOB_ENABLED=true
 * (el resto de jobs de avisos siguen apagados por defecto en local).
 */
export function startBirthdayNotificationJob(): void {
  const enabled =
    (process.env.BIRTHDAY_NOTIFICATION_JOB_ENABLED ?? "")
      .trim()
      .toLowerCase() === "true";
  if (!enabled) {
    console.info("Job de notificaciones de cumpleaños deshabilitado");
    return;
  }

  const { timeZone, hour, minute } = getSchedule();

  async function tick(): Promise<void> {
    try {
      await processBirthdayNotifications();
      await processOutbox();
    } catch (error) {
      console.error("Fallo job de cumpleaños", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      scheduleNext();
    }
  }

  function scheduleNext(): void {
    const delayMs = msUntilNextDailyRun(timeZone, hour, minute);
    setTimeout(() => {
      void tick();
    }, delayMs);
    console.info("Próxima ejecución de cumpleaños programada", {
      timeZone,
      hour,
      minute,
      delayMs,
      nextRunApprox: new Date(Date.now() + delayMs).toISOString(),
    });
  }

  const runOnStartup = process.env.BIRTHDAY_JOB_RUN_ON_STARTUP === "true";
  if (runOnStartup) {
    const startupDelayMs =
      Number.parseInt(
        process.env.NOTIFICATION_OUTBOX_JOB_INITIAL_DELAY_MS ?? "",
        10,
      ) || 15_000;
    setTimeout(() => {
      void tick();
    }, startupDelayMs);
    console.info(
      "Job de cumpleaños iniciado (arranque + diario)",
      { timeZone, hour, minute, startupDelayMs },
    );
    return;
  }

  scheduleNext();
  console.info("Job de cumpleaños iniciado (solo diario)", {
    timeZone,
    hour,
    minute,
  });
}
