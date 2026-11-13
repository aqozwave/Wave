import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createSystemAnnouncementHandler,
  deleteSystemAnnouncementHandler,
  listAdminSystemAnnouncementsHandler,
  listSystemAnnouncementsHandler,
  markAllSystemAnnouncementsReadHandler,
  markSystemAnnouncementReadHandler,
  updateSystemAnnouncementHandler,
} from "./systemAnnouncements.controller.js";
import {
  createSystemAnnouncementRequestSchema,
  deleteSystemAnnouncementRequestSchema,
  listAdminSystemAnnouncementsRequestSchema,
  listSystemAnnouncementsRequestSchema,
  markAllSystemAnnouncementsReadRequestSchema,
  markSystemAnnouncementReadRequestSchema,
  updateSystemAnnouncementRequestSchema,
} from "./systemAnnouncements.schemas.js";

/**
 * Avisos de sistema bajo /api/v1/system-announcements.
 * Lectura/mark: cualquier autenticado. CRUD admin: solo superadmin.
 */
export const systemAnnouncementsRouter = Router();

systemAnnouncementsRouter.use(authenticate);

systemAnnouncementsRouter.get(
  "/",
  validate(listSystemAnnouncementsRequestSchema),
  listSystemAnnouncementsHandler,
);

systemAnnouncementsRouter.post(
  "/read-all",
  validate(markAllSystemAnnouncementsReadRequestSchema),
  markAllSystemAnnouncementsReadHandler,
);

/** Rutas admin fijas antes de /:id/read. */
systemAnnouncementsRouter.get(
  "/admin",
  requireSuperadmin,
  validate(listAdminSystemAnnouncementsRequestSchema),
  listAdminSystemAnnouncementsHandler,
);

systemAnnouncementsRouter.post(
  "/admin",
  requireSuperadmin,
  validate(createSystemAnnouncementRequestSchema),
  createSystemAnnouncementHandler,
);

systemAnnouncementsRouter.patch(
  "/admin/:id",
  requireSuperadmin,
  validate(updateSystemAnnouncementRequestSchema),
  updateSystemAnnouncementHandler,
);

systemAnnouncementsRouter.delete(
  "/admin/:id",
  requireSuperadmin,
  validate(deleteSystemAnnouncementRequestSchema),
  deleteSystemAnnouncementHandler,
);

systemAnnouncementsRouter.post(
  "/:id/read",
  validate(markSystemAnnouncementReadRequestSchema),
  markSystemAnnouncementReadHandler,
);
