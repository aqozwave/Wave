import type { BusinessModuleKey } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import {
  assertBusinessModuleEnabled,
} from "../lib/businessModules.js";
import { AppError } from "../lib/errors.js";
import { BUSINESS_MODULE_KEYS } from "../lib/permissions.js";

/**
 * Resuelve el businessId del tenant para el chequeo de módulo.
 * Por defecto: empresa del usuario autenticado.
 */
export type ResolveBusinessId = (
  req: Request,
) => string | null | undefined;

/** Default: businessId del actor (tenant del JWT). */
const defaultBusinessId: ResolveBusinessId = (req) =>
  req.user?.businessId ?? null;

/**
 * Núcleo compartido: valida actor + módulo enabled.
 * Sin bypass de superadmin: el interruptor es de la empresa (capa 1), no del rol.
 * El PATCH que prende/apaga módulos (S6) no debe usar este middleware.
 */
async function enforceModule(
  req: Request,
  key: string,
  businessId: string | null,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new AppError(401, "unauthorized", "Token requerido"));
    return;
  }

  if (!(BUSINESS_MODULE_KEYS as readonly string[]).includes(key)) {
    next(new AppError(400, "validation_error", `Módulo inválido: ${key}`));
    return;
  }

  try {
    await assertBusinessModuleEnabled(businessId, key);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Exige que el submódulo Prevención esté activo en la empresa (capa 1).
 * - 403 `MODULE_DISABLED` si está apagado o no hay businessId.
 * Usar después de `authenticate`, antes del controller.
 *
 * @example
 * router.get("/", authenticate, requireModule("contractors"), listHandler);
 * router.get("/:businessId/…", authenticate, requireModule("work_permits", (req) => req.params.businessId), …);
 */
export function requireModule(
  key: BusinessModuleKey | (typeof BUSINESS_MODULE_KEYS)[number],
  resolveBusinessId: ResolveBusinessId = defaultBusinessId,
) {
  return async function requireModuleMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    await enforceModule(req, key, resolveBusinessId(req) ?? null, next);
  };
}

/**
 * Igual que requireModule, pero `key` y `businessId` salen de params de la ruta.
 * Útil para sondas y rutas anidadas `/businesses/:id/modules/:key/…`.
 * Además exige tenant: solo superadmin sonda otra empresa (evita reconocimiento).
 */
export function requireModuleFromParams(
  businessIdParam = "id",
  keyParam = "key",
) {
  return async function requireModuleFromParamsMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user) {
      next(new AppError(401, "unauthorized", "Token requerido"));
      return;
    }

    const rawBusiness = req.params[businessIdParam];
    const rawKey = req.params[keyParam];
    const businessId = typeof rawBusiness === "string" ? rawBusiness : null;
    const key = typeof rawKey === "string" ? rawKey : "";

    // No filtrar existencia: misma empresa o superadmin; si no, 404 genérico.
    if (
      req.user.internalRol !== "superadmin" &&
      (!req.user.businessId || req.user.businessId !== businessId)
    ) {
      next(new AppError(404, "business_not_found", "Empresa no encontrada"));
      return;
    }

    await enforceModule(req, key, businessId, next);
  };
}
