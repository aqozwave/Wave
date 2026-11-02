import { processOutbox } from "../modules/notificationOutbox/notificationOutboxWorker.service.js";

/** Intervalo por defecto: 5 minutos (portal viejo). */
const DEFAULT_INTERVAL_MS = 5 * 60_000;

/** Lee intervalo del env; fallback al default. */
function getIntervalMs(): number {
  const fromEnv = Number.parseInt(
    process.env.NOTIFICATION_OUTBOX_JOB_INTERVAL_MS ?? "",
    10,
  );
  return Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : DEFAULT_INTERVAL_MS;
}

/**
 * Arranca el worker de outbox en el mismo proceso (patrón A / portal viejo).
 * Deshabilitado si NOTIFICATION_OUTBOX_JOB_ENABLED=false.
 */
export function startNotificationOutboxJob(): void {
  const enabled = process.env.NOTIFICATION_OUTBOX_JOB_ENABLED !== "false";
  if (!enabled) {
    console.info("Job de outbox de notificaciones deshabilitado");
    return;
  }

  const intervalMs = getIntervalMs();

  async function tick(): Promise<void> {
    try {
      await processOutbox();
    } catch (error) {
      console.error("Fallo job de outbox de notificaciones", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const startupDelayMs =
    Number.parseInt(
      process.env.NOTIFICATION_OUTBOX_JOB_INITIAL_DELAY_MS ?? "",
      10,
    ) || 20_000;

  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, intervalMs);
  }, startupDelayMs);

  console.info("Job de outbox de notificaciones iniciado", {
    intervalMs,
    startupDelayMs,
  });
}
