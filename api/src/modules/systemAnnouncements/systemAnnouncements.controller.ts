import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createSystemAnnouncementResponseSchema,
  deleteSystemAnnouncementResponseSchema,
  listAdminSystemAnnouncementsResponseSchema,
  listSystemAnnouncementsResponseSchema,
  updateSystemAnnouncementResponseSchema,
  type CreateSystemAnnouncementBody,
  type ListAdminSystemAnnouncementsQuery,
  type ListSystemAnnouncementsQuery,
  type UpdateSystemAnnouncementBody,
} from "./systemAnnouncements.schemas.js";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncementsAdmin,
  listAnnouncementsForUser,
  markAllAnnouncementsRead,
  markAnnouncementRead,
  updateAnnouncement,
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

/** GET /system-announcements/admin — listado superadmin. */
export async function listAdminSystemAnnouncementsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as ListAdminSystemAnnouncementsQuery;
  const result = await listAnnouncementsAdmin(query);
  res
    .status(200)
    .json(listAdminSystemAnnouncementsResponseSchema.parse(result));
}

/** POST /system-announcements/admin — publicar. */
export async function createSystemAnnouncementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateSystemAnnouncementBody;
  const created = await createAnnouncement(req.user.id, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "system",
    resourceId: created.id,
    targetLabel: created.title,
  });
  res.status(201).json(createSystemAnnouncementResponseSchema.parse(created));
}

/** PATCH /system-announcements/admin/:id */
export async function updateSystemAnnouncementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const body = req.body as UpdateSystemAnnouncementBody;
  const updated = await updateAnnouncement(id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "system",
    resourceId: updated.id,
    targetLabel: updated.title,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateSystemAnnouncementResponseSchema.parse(updated));
}

/** DELETE /system-announcements/admin/:id — soft. */
export async function deleteSystemAnnouncementHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const deleted = await deleteAnnouncement(id);
  auditWrite(req, {
    action: "DELETE",
    resource: "system",
    resourceId: deleted.id,
    targetLabel: deleted.title,
  });
  res.status(200).json(deleteSystemAnnouncementResponseSchema.parse(deleted));
}
