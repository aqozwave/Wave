import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  listSystemAnnouncementsResponseSchema,
  type ListSystemAnnouncementsQuery,
} from "./systemAnnouncements.schemas.js";
import {
  listAnnouncementsForUser,
  markAllAnnouncementsRead,
  markAnnouncementRead,
} from "./systemAnnouncements.service.js";

/** GET /system-announcements — avisos del usuario autenticado. */
export async function listSystemAnnouncementsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListSystemAnnouncementsQuery;
  const result = await listAnnouncementsForUser(req.user.id, query);
  res.status(200).json(listSystemAnnouncementsResponseSchema.parse(result));
}

/** POST /system-announcements/:id/read */
export async function markSystemAnnouncementReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await markAnnouncementRead(req.user.id, id);
  res.status(200).json(listSystemAnnouncementsResponseSchema.parse(result));
}

/** POST /system-announcements/read-all */
export async function markAllSystemAnnouncementsReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const result = await markAllAnnouncementsRead(req.user.id);
  res.status(200).json(listSystemAnnouncementsResponseSchema.parse(result));
}
