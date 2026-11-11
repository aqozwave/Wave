import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
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

/** Rutas fijas antes de /:id/retry. */
notificationOutboxRouter.post(
  "/run-course-expiry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  runCourseExpiryHandler,
);

notificationOutboxRouter.post(
  "/run-boarding-book-expiry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  runBoardingBookExpiryHandler,
);

notificationOutboxRouter.post(
  "/run-training-expiry",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  runTrainingExpiryHandler,
);

notificationOutboxRouter.post(
  "/process",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
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
