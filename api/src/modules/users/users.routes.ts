import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  unlockUserHandler,
  updateUserHandler,
} from "./users.controller.js";
import {
  createUserRequestSchema,
  deleteUserRequestSchema,
  getUserRequestSchema,
  listUsersRequestSchema,
  unlockUserRequestSchema,
  updateUserRequestSchema,
} from "./users.schemas.js";

/**
 * Rutas de usuarios bajo /api/v1/users.
 * RBAC: maestros.users.*; superadmin bypass en requirePermission.
 */
export const usersRouter = Router();

usersRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.READ,
  ),
  validate(listUsersRequestSchema),
  listUsersHandler,
);

usersRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createUserRequestSchema),
  createUserHandler,
);

usersRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.READ,
  ),
  validate(getUserRequestSchema),
  getUserHandler,
);

usersRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateUserRequestSchema),
  updateUserHandler,
);

usersRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteUserRequestSchema),
  deleteUserHandler,
);

usersRouter.post(
  "/:id/unlock",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.MAESTROS_USERS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(unlockUserRequestSchema),
  unlockUserHandler,
);
