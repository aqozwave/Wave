import { AppError } from "./errors.js";

/** Actor mínimo para resolver tenant (sin depender de AuthUser completo). */
export type TenantActor = {
  internalRol: string;
  businessId: string | null;
};

/**
 * Empresa de un alta: solo superadmin elige `businessId` del body.
 * Cualquier otro rol queda anclado a su empresa (evita cruce de tenant).
 */
export function resolveRequiredBusinessId(
  actor: TenantActor,
  bodyBusinessId: string | null | undefined,
  entityLabel: string,
): string {
  if (actor.internalRol === "superadmin") {
    if (!bodyBusinessId) {
      throw new AppError(
        400,
        "validation_error",
        `businessId es requerido para crear ${entityLabel}`,
      );
    }
    return bodyBusinessId;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }
  return actor.businessId;
}

/**
 * Empresa en un PATCH: solo superadmin puede mover de tenant.
 * Si el body no manda businessId, se conserva el actual.
 */
export function resolveNextBusinessId(
  actor: TenantActor,
  requestedBusinessId: string | null | undefined,
  currentBusinessId: string,
): string {
  if (requestedBusinessId === undefined) {
    return currentBusinessId;
  }

  if (actor.internalRol !== "superadmin") {
    if (!actor.businessId || requestedBusinessId !== actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover el recurso a otra empresa",
      );
    }
    return actor.businessId;
  }

  // Superadmin tampoco deja businessId en null en recursos con tenant obligatorio.
  if (!requestedBusinessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido",
    );
  }
  return requestedBusinessId;
}

/**
 * Alta de usuario: superadmin puede omitir businessId (p. ej. otro superadmin);
 * el resto siempre usa su propia empresa.
 */
export function resolveOptionalCreateBusinessId(
  actor: TenantActor,
  bodyBusinessId: string | null | undefined,
): string | null {
  if (actor.internalRol === "superadmin") {
    return bodyBusinessId === undefined ? null : bodyBusinessId;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }
  return actor.businessId;
}

/**
 * True si el actor es del portal contratista (externo).
 * Esas cuentas no deben usar acciones de staff ni el panel interno.
 */
export function isContractorPortalActor(actor: {
  organizationId?: string | null;
}): boolean {
  return Boolean(actor.organizationId);
}

/**
 * Bloquea acciones de staff (aprobar HAB, validar docs, etc.) a usuarios externos.
 */
export function assertInternalStaffActor(actor: {
  organizationId?: string | null;
}): void {
  if (isContractorPortalActor(actor)) {
    throw new AppError(
      403,
      "forbidden",
      "Esta acción es solo para personal interno",
    );
  }
}
