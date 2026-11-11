import { z } from "../../lib/zod.js";

/** Días de aviso permitidos (portal viejo ALLOWED_EXPIRY_NOTICE_DAYS). */
export const ALLOWED_EXPIRY_NOTICE_DAYS = [30, 25, 15, 10] as const;

/** Defaults si aún no hay fila en system_settings. */
export const DEFAULT_EXPIRY_NOTIFICATION_SETTINGS = {
  courseCrewDays: [30, 25, 15, 10],
  courseAdminDays: [30, 25, 15, 10],
  boardingBookCrewDays: [30, 25, 15, 10],
  boardingBookAdminDays: [30, 25, 15, 10],
  /** Capacitaciones Prevención (misma ventana que cursos). */
  trainingCrewDays: [30, 25, 15, 10],
  trainingAdminDays: [30, 25, 15, 10],
  courseExpiredCrewRepeatDays: 7,
  courseExpiredCrewMaxReminders: 4,
  trainingExpiredCrewRepeatDays: 7,
  trainingExpiredCrewMaxReminders: 4,
} as const;

/** Clave estable en system_settings (portal viejo). */
export const EXPIRY_NOTIFICATION_SETTINGS_KEY = "expiry_notification_settings";

/** Un hito de días-antes: solo valores del set permitido. */
const noticeDaySchema = z.number().int().refine(
  (d) => (ALLOWED_EXPIRY_NOTICE_DAYS as readonly number[]).includes(d),
  { message: "Día de aviso no permitido (30, 25, 15 o 10)" },
);

/** Lista de hitos; se normaliza a únicos ordenados como ALLOWED. */
const noticeDaysSchema = z.array(noticeDaySchema).max(10);

/** Contrato de settings de vencimiento. */
export const expiryNotificationSettingsSchema = z
  .object({
    courseCrewDays: noticeDaysSchema,
    courseAdminDays: noticeDaysSchema,
    boardingBookCrewDays: noticeDaysSchema,
    boardingBookAdminDays: noticeDaysSchema,
    trainingCrewDays: noticeDaysSchema,
    trainingAdminDays: noticeDaysSchema,
    /** Cada cuántos días reavisar curso ya vencido al tripulante. */
    courseExpiredCrewRepeatDays: z.number().int().min(0).max(90),
    /** Tope de recordatorios de curso vencido. */
    courseExpiredCrewMaxReminders: z.number().int().min(1).max(52),
    /** Cada cuántos días reavisar capacitación ya vencida al tripulante. */
    trainingExpiredCrewRepeatDays: z.number().int().min(0).max(90),
    /** Tope de recordatorios de capacitación vencida. */
    trainingExpiredCrewMaxReminders: z.number().int().min(1).max(52),
  })
  .openapi("ExpiryNotificationSettings");

export type ExpiryNotificationSettings = z.infer<
  typeof expiryNotificationSettingsSchema
>;

/** GET /notification-settings/expiry — sin query/body. */
export const getExpiryNotificationSettingsRequestSchema = z.object({});

export const getExpiryNotificationSettingsResponseSchema =
  expiryNotificationSettingsSchema;

/** PUT parcial: al menos un campo. */
export const updateExpiryNotificationSettingsBodySchema = z
  .object({
    courseCrewDays: noticeDaysSchema.optional(),
    courseAdminDays: noticeDaysSchema.optional(),
    boardingBookCrewDays: noticeDaysSchema.optional(),
    boardingBookAdminDays: noticeDaysSchema.optional(),
    trainingCrewDays: noticeDaysSchema.optional(),
    trainingAdminDays: noticeDaysSchema.optional(),
    courseExpiredCrewRepeatDays: z.number().int().min(0).max(90).optional(),
    courseExpiredCrewMaxReminders: z.number().int().min(1).max(52).optional(),
    trainingExpiredCrewRepeatDays: z.number().int().min(0).max(90).optional(),
    trainingExpiredCrewMaxReminders: z.number().int().min(1).max(52).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo",
  });

export const updateExpiryNotificationSettingsRequestSchema = z.object({
  body: updateExpiryNotificationSettingsBodySchema,
});

export const updateExpiryNotificationSettingsResponseSchema =
  expiryNotificationSettingsSchema;

export type UpdateExpiryNotificationSettingsBody = z.infer<
  typeof updateExpiryNotificationSettingsBodySchema
>;
