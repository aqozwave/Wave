import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

/**
 * Solo superadmin (internalRol).
 * El Administrador y el resto se rigen por Role.permissions vía requirePermission;
 * no usar este middleware para “abrir” mutaciones a admin.
 * Preferí requirePermission en rutas de negocio; este gate queda para
 * operaciones exclusivas de sistema si hiciera falta.
 */
export function requireTenantManager(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError(401, "unauthorized", "Token requerido"));
    return;
  }

  if (req.user.internalRol !== "superadmin") {
    next(
      new AppError(
        403,
        "forbidden",
        "Solo el superadmin puede realizar esta acción",
      ),
    );
    return;
  }

  next();
}
