/**
 * Capa 1 de autorización Prevención: módulos activos por empresa.
 * Fila ausente en business_modules = apagado (enabled false).
 */

import type { BusinessModuleKey } from "@prisma/client";
import { AppError } from "./errors.js";
import {
  BUSINESS_MODULE_KEYS,
  RESOURCE_TO_MODULE_KEY,
} from "./permissions.js";
import { prisma } from "./prisma.js";

/** Estado de un submódulo para el cliente (/me). */
export type BusinessModuleState = {
  key: string;
  enabled: boolean;
};

/**
 * Lista los 3 keys con su estado para un tenant.
 * Sin businessId → todos apagados (no hay contexto de empresa).
 */
export async function listBusinessModuleStates(
  businessId: string | null | undefined,
): Promise<BusinessModuleState[]> {
  if (!businessId) {
    return BUSINESS_MODULE_KEYS.map((key) => ({ key, enabled: false }));
  }

  const rows = await prisma.businessModule.findMany({
    where: { businessId },
    select: { key: true, enabled: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.enabled]));

  return BUSINESS_MODULE_KEYS.map((key) => ({
    key,
    enabled: byKey.get(key) === true,
  }));
}

/** Set de keys con enabled=true (para filtrar permisos). */
export async function getEnabledModuleKeySet(
  businessId: string | null | undefined,
): Promise<Set<string>> {
  const states = await listBusinessModuleStates(businessId);
  return new Set(states.filter((row) => row.enabled).map((row) => row.key));
}

/**
 * ¿Está prendido este submódulo en la empresa?
 * Sin fila o sin businessId → false.
 */
export async function isBusinessModuleEnabled(
  businessId: string | null | undefined,
  key: BusinessModuleKey | string,
): Promise<boolean> {
  if (!businessId) return false;
  const row = await prisma.businessModule.findUnique({
    where: {
      businessId_key: {
        businessId,
        key: key as BusinessModuleKey,
      },
    },
    select: { enabled: true },
  });
  return row?.enabled === true;
}

/**
 * Lanza 403 MODULE_DISABLED si el submódulo no está activo.
 * Lo usan `requireModule` y services de dominio Prevención.
 */
export async function assertBusinessModuleEnabled(
  businessId: string | null | undefined,
  key: BusinessModuleKey | string,
): Promise<void> {
  const on = await isBusinessModuleEnabled(businessId, key);
  if (on) return;
  throw new AppError(
    403,
    "MODULE_DISABLED",
    `El módulo "${key}" no está activo en esta empresa`,
    { key },
  );
}

/**
 * Quita permisos cuyo resource depende de un módulo apagado.
 * Resources base (sin entrada en RESOURCE_TO_MODULE_KEY) siempre pasan.
 */
export function filterPermissionsByModules<
  T extends { resource: string; actions: readonly string[] | string[] },
>(permissions: T[], enabledKeys: Set<string>): T[] {
  return permissions.filter((row) => {
    const moduleKey = RESOURCE_TO_MODULE_KEY[row.resource];
    if (moduleKey == null) return true;
    return enabledKeys.has(moduleKey);
  });
}
