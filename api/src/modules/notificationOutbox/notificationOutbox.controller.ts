import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { processCourseExpiryNotifications } from "./courseExpiryNotification.service.js";
import {
  listNotificationOutboxResponseSchema,
  processCourseExpiryResponseSchema,
  processOutboxResponseSchema,
  retryNotificationOutboxResponseSchema,
  type ListNotificationOutboxQuery,
  type ProcessOutboxQuery,
} from "./notificationOutbox.schemas.js";
import {
  listNotificationOutbox,
  retryNotificationOutbox,
} from "./notificationOutbox.service.js";
import { processOutbox } from "./notificationOutboxWorker.service.js";

/** GET /notification-outbox */
export async function listNotificationOutboxHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListNotificationOutboxQuery;
  const result = await listNotificationOutbox(req.user, query);
  res.status(200).json(listNotificationOutboxResponseSchema.parse(result));
}

/**
 * POST /notification-outbox/run-course-expiry
 * Dispara el generador a mano (jobs siguen off). Solo encola; no envía.
 */
export async function runCourseExpiryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await processCourseExpiryNotifications();
  res.status(200).json(processCourseExpiryResponseSchema.parse(result));
}

/**
 * POST /notification-outbox/process
 * Corre el worker: claim → Resend (con override) → sent/failed.
 * Jobs siguen off; usá esto para probar envíos a fsoto@.
 */
export async function processOutboxHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ProcessOutboxQuery;
  const result = await processOutbox({ maxBatch: query.limit ?? 50 });
  res.status(200).json(processOutboxResponseSchema.parse(result));
}

/** POST /notification-outbox/:id/retry */
export async function retryNotificationOutboxHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const id = req.params.id as string;
  const result = await retryNotificationOutbox(req.user, id);
  res.status(200).json(retryNotificationOutboxResponseSchema.parse(result));
}
