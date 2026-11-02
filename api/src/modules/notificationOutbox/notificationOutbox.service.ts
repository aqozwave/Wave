import {
  Prisma,
  type NotificationOutbox,
  type NotificationOutboxStatus,
  type NotificationOutboxType,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  ListNotificationOutboxQuery,
  NotificationOutboxItem,
} from "./notificationOutbox.schemas.js";

/** Backoff tras cada fallo (ms); índice = attempts - 1. Portal viejo. */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

/** Tras este tiempo en processing, se rescata a pending. */
export const STALE_PROCESSING_MS = 10 * 60_000;

/** Serializa fila Prisma → contrato API (ISO strings). */
function toItem(row: NotificationOutbox): NotificationOutboxItem {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    type: row.type,
    dedupeKey: row.dedupeKey,
    to: row.to,
    payload: row.payload ?? null,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError,
    lockedAt: row.lockedAt ? row.lockedAt.toISOString() : null,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    businessId: row.businessId,
    crewMemberId: row.crewMemberId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Alcance tenant del listado/retry.
 * Admin: solo su empresa. Superadmin: todas (opcional ?businessId=).
 */
function tenantBusinessFilter(
  actor: Pick<AuthUser, "internalRol" | "businessId">,
  requestedBusinessId?: string,
): string | undefined {
  if (actor.internalRol === "superadmin") {
    return requestedBusinessId;
  }
  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }
  return actor.businessId;
}

/**
 * Lista filas del outbox con filtros y paginación.
 * No envía correos: solo lectura de cola.
 */
export async function listNotificationOutbox(
  actor: AuthUser,
  query: ListNotificationOutboxQuery,
): Promise<{
  items: NotificationOutboxItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const businessId = tenantBusinessFilter(actor, query.businessId);
  const where: Prisma.NotificationOutboxWhereInput = {};

  if (businessId) where.businessId = businessId;
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  const term = query.search?.trim();
  if (term) {
    where.to = { contains: term, mode: "insensitive" };
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.notificationOutbox.count({ where }),
    prisma.notificationOutbox.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(toItem),
    total,
    page,
    limit,
  };
}

/**
 * Reencola a mano una fila failed/cancelled → pending.
 * Resetea attempts para un ciclo completo; no envía el mail aquí.
 */
export async function retryNotificationOutbox(
  actor: AuthUser,
  id: string,
): Promise<NotificationOutboxItem> {
  const businessId = tenantBusinessFilter(actor);
  const row = await prisma.notificationOutbox.findFirst({
    where: {
      id,
      ...(businessId ? { businessId } : {}),
    },
  });

  if (!row) {
    throw new AppError(404, "not_found", "Aviso no encontrado");
  }

  if (row.status !== "failed" && row.status !== "cancelled") {
    throw new AppError(
      409,
      "invalid_status",
      "Solo se pueden reintentar avisos failed o cancelled",
    );
  }

  const updated = await prisma.notificationOutbox.update({
    where: { id: row.id },
    data: {
      status: "pending",
      attempts: 0,
      lastError: null,
      lockedAt: null,
      sentAt: null,
      nextAttemptAt: new Date(),
    },
  });

  return toItem(updated);
}

/**
 * Toma la siguiente fila pending lista para enviar (atómico a nivel fila).
 * Incrementa attempts y pasa a processing.
 */
export async function claimNextPending(options?: {
  now?: Date;
}): Promise<NotificationOutbox | null> {
  const now = options?.now ?? new Date();
  const next = await prisma.notificationOutbox.findFirst({
    where: {
      status: "pending",
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: "asc" },
  });
  if (!next) return null;

  return prisma.notificationOutbox.update({
    where: { id: next.id },
    data: {
      status: "processing",
      lockedAt: now,
      attempts: { increment: 1 },
    },
  });
}

/** Cancela una fila (payload inválido / entidad ya no aplica). */
export async function markCancelled(
  outboxId: string,
): Promise<NotificationOutboxItem | null> {
  try {
    const row = await prisma.notificationOutbox.update({
      where: { id: outboxId },
      data: {
        status: "cancelled",
        lockedAt: null,
      },
    });
    return toItem(row);
  } catch {
    return null;
  }
}

/**
 * Encola un aviso. Si dedupeKey ya existe, no inserta (idempotente).
 * Usado por el generador de S9 (paso 3+).
 */
export async function enqueueNotification(input: {
  type: NotificationOutboxType;
  dedupeKey: string;
  to: string;
  payload?: Prisma.InputJsonValue | null;
  businessId?: string | null;
  crewMemberId?: string | null;
  maxAttempts?: number;
}): Promise<{ inserted: boolean; item: NotificationOutboxItem | null }> {
  try {
    const row = await prisma.notificationOutbox.create({
      data: {
        type: input.type,
        dedupeKey: input.dedupeKey,
        to: input.to,
        payload: input.payload ?? Prisma.JsonNull,
        businessId: input.businessId ?? null,
        crewMemberId: input.crewMemberId ?? null,
        maxAttempts: input.maxAttempts ?? 8,
      },
    });
    return { inserted: true, item: toItem(row) };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { inserted: false, item: null };
    }
    throw err;
  }
}

/** Delay de reintento según número de attempts ya consumidos. */
function resolveRetryDelayMs(attempts: number): number {
  const index = attempts - 1;
  if (index < 0) return RETRY_DELAYS_MS[0];
  return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

/**
 * Marca enviada. Guarda resendId y destino efectivo en payload (trazabilidad).
 */
export async function markSent(
  outboxId: string,
  options?: {
    now?: Date;
    resendId?: string | null;
    deliveredTo?: string | null;
  },
): Promise<NotificationOutboxItem | null> {
  const now = options?.now ?? new Date();
  try {
    const current = await prisma.notificationOutbox.findUnique({
      where: { id: outboxId },
    });
    if (!current) return null;

    const base =
      current.payload &&
      typeof current.payload === "object" &&
      !Array.isArray(current.payload)
        ? { ...(current.payload as Record<string, unknown>) }
        : {};

    if (options?.resendId) base.resendId = options.resendId;
    if (options?.deliveredTo) base.deliveredTo = options.deliveredTo;

    const row = await prisma.notificationOutbox.update({
      where: { id: outboxId },
      data: {
        status: "sent" satisfies NotificationOutboxStatus,
        sentAt: now,
        lockedAt: null,
        lastError: null,
        payload: base as Prisma.InputJsonValue,
      },
    });
    return toItem(row);
  } catch {
    return null;
  }
}

/**
 * Destino efectivo del mail de outbox.
 * Con NOTIFICATION_EMAIL_OVERRIDE todo va a ese correo (prueba mientras el portal viejo vive).
 */
export function resolveNotificationRecipient(logicalTo: string): {
  to: string;
  overridden: boolean;
  logicalTo: string;
} {
  const override = process.env.NOTIFICATION_EMAIL_OVERRIDE?.trim();
  if (override) {
    return { to: override.toLowerCase(), overridden: true, logicalTo };
  }
  return {
    to: logicalTo.trim().toLowerCase(),
    overridden: false,
    logicalTo,
  };
}

/**
 * Registra fallo: reencola con backoff o pasa a failed si agotó intentos.
 */
export async function markFailed(
  outboxId: string,
  errorMessage: unknown,
  options?: { now?: Date },
): Promise<NotificationOutboxItem | null> {
  const now = options?.now ?? new Date();
  const row = await prisma.notificationOutbox.findUnique({
    where: { id: outboxId },
  });
  if (!row) return null;

  const message = String(errorMessage ?? "Unknown error");

  if (row.attempts >= row.maxAttempts) {
    const failed = await prisma.notificationOutbox.update({
      where: { id: outboxId },
      data: {
        status: "failed",
        lastError: message,
        lockedAt: null,
      },
    });
    return toItem(failed);
  }

  const delayMs = resolveRetryDelayMs(row.attempts);
  const nextAttemptAt = new Date(now.getTime() + delayMs);
  const pending = await prisma.notificationOutbox.update({
    where: { id: outboxId },
    data: {
      status: "pending",
      lastError: message,
      lockedAt: null,
      nextAttemptAt,
    },
  });
  return toItem(pending);
}

/** Cancela pending de un tripulante (p. ej. baja). */
export async function cancelPendingForCrewMember(
  crewMemberId: string,
): Promise<number> {
  const result = await prisma.notificationOutbox.updateMany({
    where: { crewMemberId, status: "pending" },
    data: { status: "cancelled", lockedAt: null },
  });
  return result.count;
}

/** Rescata filas processing abandonadas (proceso murió mid-envío). */
export async function recoverStaleProcessing(options?: {
  now?: Date;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - STALE_PROCESSING_MS);
  const result = await prisma.notificationOutbox.updateMany({
    where: {
      status: "processing",
      lockedAt: { lte: cutoff },
    },
    data: {
      status: "pending",
      lockedAt: null,
    },
  });
  return result.count;
}
