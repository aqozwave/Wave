import { runComplianceSnapshotsForAllBusinesses } from "../modules/dashboard/dashboardCompliance.service.js";

/** Zona horaria del disparo diario (Chile). */
const DEFAULT_TIMEZONE = "America/Santiago";
/** Hora local del disparo (después de los avisos de cursos). */
const DEFAULT_HOUR = 8;
/** Minuto local del disparo. */
const DEFAULT_MINUTE = 20;

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

/** Lee timezone / hora / minuto del env. */
function getSchedule(): {
  timeZone: string;
  hour: number;
  minute: number;
} {
  const timeZone =
    process.env.COMPLIANCE_SNAPSHOT_JOB_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
  const hourRaw = Number.parseInt(
    process.env.COMPLIANCE_SNAPSHOT_JOB_HOUR ?? "",
    10,
  );
  const minuteRaw = Number.parseInt(
    process.env.COMPLIANCE_SNAPSHOT_JOB_MINUTE ?? "",
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
 * Job diario: guarda % cumplimiento del mes (empresa + naves).
 * Deshabilitado si COMPLIANCE_SNAPSHOT_JOB_ENABLED=false.
 */
export function startComplianceSnapshotJob(): void {
  const enabled = process.env.COMPLIANCE_SNAPSHOT_JOB_ENABLED !== "false";
  if (!enabled) {
    console.info("Job de snapshots de cumplimiento deshabilitado");
    return;
  }

  const { timeZone, hour, minute } = getSchedule();

  async function tick(): Promise<void> {
    try {
      const result = await runComplianceSnapshotsForAllBusinesses();
      console.info("Snapshots de cumplimiento escritos", result);
    } catch (error) {
      console.error("Fallo job de snapshots de cumplimiento", {
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
    console.info("Próxima ejecución de snapshots de cumplimiento", {
      timeZone,
      hour,
      minute,
      delayMs,
      nextRunApprox: new Date(Date.now() + delayMs).toISOString(),
    });
  }

  const runOnStartup =
    process.env.COMPLIANCE_SNAPSHOT_JOB_RUN_ON_STARTUP !== "false";
  if (runOnStartup) {
    const startupDelayMs =
      Number.parseInt(
        process.env.COMPLIANCE_SNAPSHOT_JOB_INITIAL_DELAY_MS ?? "",
        10,
      ) || 20_000;
    setTimeout(() => {
      void tick();
    }, startupDelayMs);
    console.info(
      "Job de snapshots de cumplimiento iniciado (arranque + diario)",
      { timeZone, hour, minute, startupDelayMs },
    );
    return;
  }

  scheduleNext();
  console.info("Job de snapshots de cumplimiento iniciado (solo diario)", {
    timeZone,
    hour,
    minute,
  });
}
