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

/**
 * Pasa si el actor tiene al menos uno de los pares resource+action.
 * Sirve para pantallas que comparten API (p. ej. packs ↔ document-types).
 */
export function requireAnyPermission(
  options: ReadonlyArray<{ resource: string; action: string }>,
) {
  return async function requireAnyPermissionMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user) {
      next(new AppError(401, "unauthorized", "Token requerido"));
      return;
    }

    for (const opt of options) {
      const allowed = await actorHasPermission(
        req.user,
        opt.resource,
        opt.action,
      );
      if (allowed) {
        next();
        return;
      }
    }

    next(
      new AppError(
        403,
        "forbidden",
        "No tienes permiso para esta acción",
      ),
    );
  };
}
