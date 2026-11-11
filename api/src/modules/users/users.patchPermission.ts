import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  PERMISSION_ACTION,
  PERMISSION_RESOURCE,
} from "../../lib/permissions.js";
import { actorHasPermission } from "../roles/roles.service.js";
import type { UpdateUserBody } from "./users.schemas.js";

/**
 * PATCH /users/:id: state → deactivate; cualquier otro campo → update.
 * Un body mixto exige ambos permisos. Superadmin bypass en actorHasPermission.
 */
export async function requireUsersPatchPermission(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new AppError(401, "unauthorized", "Token requerido"));
    return;
  }

  const body = req.body as UpdateUserBody;
  const touchesState = body.state !== undefined;
  const touchesOther = Object.entries(body).some(
    ([key, value]) => key !== "state" && value !== undefined,
  );

  if (touchesState) {
    const allowed = await actorHasPermission(
      req.user,
      PERMISSION_RESOURCE.MAESTROS_USERS,
      PERMISSION_ACTION.DEACTIVATE,
    );
    if (!allowed) {
      next(
        new AppError(
          403,
          "forbidden",
          "No tienes permiso para activar o desactivar usuarios",
        ),
      );
      return;
    }
  }

  if (touchesOther) {
    const allowed = await actorHasPermission(
      req.user,
      PERMISSION_RESOURCE.MAESTROS_USERS,
      PERMISSION_ACTION.UPDATE,
    );
    if (!allowed) {
      next(
        new AppError(
          403,
          "forbidden",
          "No tienes permiso para editar usuarios",
        ),
      );
      return;
    }
  }

  next();
}
