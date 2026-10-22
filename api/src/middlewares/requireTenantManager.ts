import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

/**
 * Exige autenticación previa y rol superadmin o admin.
 * Usado en altas/ediciones de ubicaciones (mismo criterio que el portal viejo).
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

  const rol = req.user.internalRol;
  if (rol !== "superadmin" && rol !== "admin") {
    next(
      new AppError(
        403,
        "forbidden",
        "Solo un administrador puede realizar esta acción",
      ),
    );
    return;
  }

  next();
}
