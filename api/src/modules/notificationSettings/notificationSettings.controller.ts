import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  getExpiryNotificationSettingsResponseSchema,
  updateExpiryNotificationSettingsResponseSchema,
  type UpdateExpiryNotificationSettingsBody,
} from "./notificationSettings.schemas.js";
import {
  getExpiryNotificationSettings,
  updateExpiryNotificationSettings,
} from "./notificationSettings.service.js";

/** GET /notification-settings/expiry */
export async function getExpirySettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getExpiryNotificationSettings();
  res
    .status(200)
    .json(getExpiryNotificationSettingsResponseSchema.parse(result));
}

/** PUT /notification-settings/expiry */
export async function updateExpirySettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdateExpiryNotificationSettingsBody;
  const result = await updateExpiryNotificationSettings(body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "system",
    targetLabel: "expiry_notification_settings",
    metadata: { fields: safeChangedFields(body) },
  });
  res
    .status(200)
    .json(updateExpiryNotificationSettingsResponseSchema.parse(result));
}
