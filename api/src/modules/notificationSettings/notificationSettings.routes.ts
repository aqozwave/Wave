import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  getExpirySettingsHandler,
  updateExpirySettingsHandler,
} from "./notificationSettings.controller.js";
import { updateExpiryNotificationSettingsRequestSchema } from "./notificationSettings.schemas.js";

/**
 * Settings globales de avisos de vencimiento bajo /api/v1/notification-settings.
 */
export const notificationSettingsRouter = Router();

notificationSettingsRouter.get(
  "/expiry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.READ,
  ),
  getExpirySettingsHandler,
);

notificationSettingsRouter.put(
  "/expiry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateExpiryNotificationSettingsRequestSchema),
  updateExpirySettingsHandler,
);
