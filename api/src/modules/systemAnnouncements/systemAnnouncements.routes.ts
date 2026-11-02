import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.js";
import {
  listSystemAnnouncementsHandler,
  markAllSystemAnnouncementsReadHandler,
  markSystemAnnouncementReadHandler,
} from "./systemAnnouncements.controller.js";
import {
  listSystemAnnouncementsRequestSchema,
  markAllSystemAnnouncementsReadRequestSchema,
  markSystemAnnouncementReadRequestSchema,
} from "./systemAnnouncements.schemas.js";

/**
 * Avisos de sistema bajo /api/v1/system-announcements.
 * Cualquier usuario autenticado ve y marca como leído.
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

systemAnnouncementsRouter.post(
  "/:id/read",
  validate(markSystemAnnouncementReadRequestSchema),
  markSystemAnnouncementReadHandler,
);
