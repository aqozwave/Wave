import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { actorHasPermission } from "../modules/roles/roles.service.js";

/**
 * Exige que el usuario autenticado tenga resource+action en su Role.
 * Superadmin (internalRol) siempre pasa.
 * Usar después de authenticate.
 */
export function requirePermission(resource: string, action: string) {
  return async function requirePermissionMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user) {
      next(new AppError(401, "unauthorized", "Token requerido"));
      return;
    }

    const allowed = await actorHasPermission(req.user, resource, action);
    if (!allowed) {
      next(
        new AppError(
          403,
          "forbidden",
          "No tienes permiso para esta acción",
        ),
      );
      return;
    }

    next();
  };
}
