import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  ALLOWED_EXPIRY_NOTICE_DAYS,
  DEFAULT_EXPIRY_NOTIFICATION_SETTINGS,
  EXPIRY_NOTIFICATION_SETTINGS_KEY,
  expiryNotificationSettingsSchema,
  type ExpiryNotificationSettings,
  type UpdateExpiryNotificationSettingsBody,
} from "./notificationSettings.schemas.js";

/** Cache en memoria: el job de S9 lee settings en cada tick. */
let cachedSettings: ExpiryNotificationSettings | null = null;
/** Timestamp de la última carga a cache. */
let cachedAt = 0;
/** TTL de cache: 60 s (igual portal viejo). */
const CACHE_TTL_MS = 60_000;

/**
 * Filtra y ordena hitos al set permitido (30 → 10).
 * Descarta días fuera de ALLOWED; conserva el orden canónico.
 */
function normalizeDays(values: number[] | undefined): number[] {
  const unique = new Set(
    (values ?? []).filter((d) =>
      (ALLOWED_EXPIRY_NOTICE_DAYS as readonly number[]).includes(d),
    ),
  );
  return ALLOWED_EXPIRY_NOTICE_DAYS.filter((day) => unique.has(day));
}

/** Normaliza payload crudo (BD o body) al contrato tipado. */
function normalizeSettings(
  payload: Partial<ExpiryNotificationSettings> = {},
): ExpiryNotificationSettings {
  const merged = {
    courseCrewDays: normalizeDays(
      payload.courseCrewDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseCrewDays,
      ],
    ),
    courseAdminDays: normalizeDays(
      payload.courseAdminDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseAdminDays,
      ],
    ),
    boardingBookCrewDays: normalizeDays(
      payload.boardingBookCrewDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookCrewDays,
      ],
    ),
    boardingBookAdminDays: normalizeDays(
      payload.boardingBookAdminDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookAdminDays,
      ],
    ),
    trainingCrewDays: normalizeDays(
      payload.trainingCrewDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingCrewDays,
      ],
    ),
    trainingAdminDays: normalizeDays(
      payload.trainingAdminDays ?? [
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingAdminDays,
      ],
    ),
    courseExpiredCrewRepeatDays:
      typeof payload.courseExpiredCrewRepeatDays === "number" &&
      payload.courseExpiredCrewRepeatDays >= 0
        ? payload.courseExpiredCrewRepeatDays
        : DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseExpiredCrewRepeatDays,
    courseExpiredCrewMaxReminders:
      typeof payload.courseExpiredCrewMaxReminders === "number" &&
      payload.courseExpiredCrewMaxReminders >= 1
        ? payload.courseExpiredCrewMaxReminders
        : DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseExpiredCrewMaxReminders,
    trainingExpiredCrewRepeatDays:
      typeof payload.trainingExpiredCrewRepeatDays === "number" &&
      payload.trainingExpiredCrewRepeatDays >= 0
        ? payload.trainingExpiredCrewRepeatDays
        : DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingExpiredCrewRepeatDays,
    trainingExpiredCrewMaxReminders:
      typeof payload.trainingExpiredCrewMaxReminders === "number" &&
      payload.trainingExpiredCrewMaxReminders >= 1
        ? payload.trainingExpiredCrewMaxReminders
        : DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingExpiredCrewMaxReminders,
  };
  return expiryNotificationSettingsSchema.parse(merged);
}

/** Interpreta el JSON de Prisma como settings parciales. */
function parseStoredValue(
  value: Prisma.JsonValue | null | undefined,
): Partial<ExpiryNotificationSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Partial<ExpiryNotificationSettings>;
}

/**
 * Lee settings de vencimiento (defaults si no hay fila).
 * Cache 60 s salvo forceRefresh.
 */
export async function getExpiryNotificationSettings(options?: {
  forceRefresh?: boolean;
}): Promise<ExpiryNotificationSettings> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const row = await prisma.systemSetting.findUnique({
    where: { key: EXPIRY_NOTIFICATION_SETTINGS_KEY },
  });
  const normalized = row
    ? normalizeSettings(parseStoredValue(row.value))
    : normalizeSettings({
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS,
        courseCrewDays: [...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseCrewDays],
        courseAdminDays: [
          ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.courseAdminDays,
        ],
        boardingBookCrewDays: [
          ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookCrewDays,
        ],
        boardingBookAdminDays: [
          ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookAdminDays,
        ],
        trainingCrewDays: [
          ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingCrewDays,
        ],
        trainingAdminDays: [
          ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.trainingAdminDays,
        ],
      });

  cachedSettings = normalized;
  cachedAt = Date.now();
  return normalized;
}

/**
 * Upsert de settings: merge con lo actual, normaliza y guarda.
 * Invalida cache.
 */
export async function updateExpiryNotificationSettings(
  body: UpdateExpiryNotificationSettingsBody,
): Promise<ExpiryNotificationSettings> {
  const current = await getExpiryNotificationSettings({ forceRefresh: true });
  const merged = normalizeSettings({ ...current, ...body });

  await prisma.systemSetting.upsert({
    where: { key: EXPIRY_NOTIFICATION_SETTINGS_KEY },
    create: {
      key: EXPIRY_NOTIFICATION_SETTINGS_KEY,
      value: merged,
    },
    update: {
      value: merged,
    },
  });

  cachedSettings = merged;
  cachedAt = Date.now();
  return merged;
}

/**
 * Máximo hito de un campo de días (para ventana del generador S9).
 * 0 si la lista está vacía.
 */
export function getMaxWarningDays(
  settings: ExpiryNotificationSettings,
  field:
    | "courseCrewDays"
    | "courseAdminDays"
    | "boardingBookCrewDays"
    | "boardingBookAdminDays"
    | "trainingCrewDays"
    | "trainingAdminDays",
): number {
  const days = settings[field];
  if (!days.length) return 0;
  return Math.max(...days);
}
