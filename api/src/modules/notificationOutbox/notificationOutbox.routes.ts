import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  listNotificationOutboxHandler,
  processOutboxHandler,
  retryNotificationOutboxHandler,
  runBoardingBookExpiryHandler,
  runCourseExpiryHandler,
  runTrainingExpiryHandler,
} from "./notificationOutbox.controller.js";
import {
  listNotificationOutboxRequestSchema,
  processOutboxRequestSchema,
  retryNotificationOutboxRequestSchema,
} from "./notificationOutbox.schemas.js";

/**
 * Cola de avisos bajo /api/v1/notification-outbox.
 * Listado, generador, worker manual y reintento.
 */
export const notificationOutboxRouter = Router();

notificationOutboxRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listNotificationOutboxRequestSchema),
  listNotificationOutboxHandler,
);

/**
 * Jobs globales (todos los tenants): solo superadmin.
 * Un admin de una empresa no debe disparar generadores/worker globales.
 */
notificationOutboxRouter.post(
  "/run-course-expiry",
  authenticate,
  requireSuperadmin,
  runCourseExpiryHandler,
);

notificationOutboxRouter.post(
  "/run-boarding-book-expiry",
  authenticate,
  requireSuperadmin,
  runBoardingBookExpiryHandler,
);

notificationOutboxRouter.post(
  "/run-training-expiry",
  authenticate,
  requireSuperadmin,
  runTrainingExpiryHandler,
);

notificationOutboxRouter.post(
  "/process",
  authenticate,
  requireSuperadmin,
  validate(processOutboxRequestSchema),
  processOutboxHandler,
);

notificationOutboxRouter.post(
  "/:id/retry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(retryNotificationOutboxRequestSchema),
  retryNotificationOutboxHandler,
);
