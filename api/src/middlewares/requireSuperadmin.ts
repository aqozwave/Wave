import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

/**
 * Exige `req.user` con internalRol === "superadmin".
 * Usar después de `authenticate` (alta de usuarios, etc.).
 */
export function requireSuperadmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError(401, "unauthorized", "Token requerido"));
    return;
  }

  if (req.user.internalRol !== "superadmin") {
    next(new AppError(403, "forbidden", "Se requiere rol superadmin"));
    return;
  }

  next();
}
