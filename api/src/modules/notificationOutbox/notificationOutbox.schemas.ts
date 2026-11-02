import { z } from "../../lib/zod.js";

/** Tipos de aviso (espejo enum Prisma / portal viejo). */
export const notificationOutboxTypeSchema = z.enum([
  "boarding_book_expiring",
  "course_expiring",
  "course_expired",
  "boarding_book_admin_digest",
  "course_admin_digest",
]);

/** Estados del worker. */
export const notificationOutboxStatusSchema = z.enum([
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

/** Fila del outbox en respuestas API. */
export const notificationOutboxItemSchema = z
  .object({
    id: z.uuid(),
    legacyMongoId: z.string().nullable(),
    type: notificationOutboxTypeSchema,
    dedupeKey: z.string(),
    to: z.string(),
    payload: z.unknown().nullable(),
    status: notificationOutboxStatusSchema,
    attempts: z.number().int(),
    maxAttempts: z.number().int(),
    nextAttemptAt: z.string().datetime(),
    lastError: z.string().nullable(),
    lockedAt: z.string().datetime().nullable(),
    sentAt: z.string().datetime().nullable(),
    businessId: z.uuid().nullable(),
    crewMemberId: z.uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("NotificationOutboxItem");

export type NotificationOutboxItem = z.infer<
  typeof notificationOutboxItemSchema
>;

/** Query de listado paginado. */
export const listNotificationOutboxQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
  status: notificationOutboxStatusSchema.optional(),
  type: notificationOutboxTypeSchema.optional(),
  /** Filtra por destinatario (substring, case-insensitive). */
  search: z.string().max(200).optional(),
  /** Solo superadmin: acotar a una empresa. */
  businessId: z.uuid().optional(),
});

export const listNotificationOutboxRequestSchema = z.object({
  query: listNotificationOutboxQuerySchema,
});

export const listNotificationOutboxResponseSchema = z
  .object({
    items: z.array(notificationOutboxItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi("ListNotificationOutboxResponse");

export type ListNotificationOutboxQuery = z.infer<
  typeof listNotificationOutboxQuerySchema
>;

/** POST /notification-outbox/:id/retry */
export const retryNotificationOutboxParamsSchema = z.object({
  id: z.uuid(),
});

export const retryNotificationOutboxRequestSchema = z.object({
  params: retryNotificationOutboxParamsSchema,
});

export const retryNotificationOutboxResponseSchema =
  notificationOutboxItemSchema;

export type NotificationOutboxType = z.infer<
  typeof notificationOutboxTypeSchema
>;
export type NotificationOutboxStatus = z.infer<
  typeof notificationOutboxStatusSchema
>;

/**
 * Resultado del generador manual de avisos de cursos.
 * No implica envío: solo filas encoladas / métricas.
 */
export const processCourseExpiryResponseSchema = z
  .object({
    expiringRows: z.number().int(),
    expiringEmails: z.number().int(),
    expiredEmails: z.number().int(),
    adminEmails: z.number().int(),
    skippedCrewWithoutEmail: z.number().int(),
    statusesSynced: z.number().int(),
    warningDays: z.number().int(),
  })
  .openapi("ProcessCourseExpiryResponse");

/**
 * Resultado del generador manual de avisos de libreta de embarque.
 * No implica envío: solo filas encoladas / métricas.
 */
export const processBoardingBookExpiryResponseSchema = z
  .object({
    expiringRows: z.number().int(),
    expiringEmails: z.number().int(),
    adminEmails: z.number().int(),
    skippedCrewWithoutEmail: z.number().int(),
    warningDays: z.number().int(),
  })
  .openapi("ProcessBoardingBookExpiryResponse");

/** Query opcional del worker manual. */
export const processOutboxQuerySchema = z.object({
  /** Cuántas filas procesar en esta corrida (prueba: 1–3). */
  limit: z.coerce.number().int().positive().max(50).default(50),
});

export const processOutboxRequestSchema = z.object({
  query: processOutboxQuerySchema,
});

export type ProcessOutboxQuery = z.infer<typeof processOutboxQuerySchema>;

/** Resultado del worker de envío (Resend / stub). */
export const processOutboxResponseSchema = z
  .object({
    recovered: z.number().int(),
    sent: z.number().int(),
    failed: z.number().int(),
    cancelled: z.number().int(),
  })
  .openapi("ProcessOutboxResponse");
