/**
 * Política de runtime del PT a partir del snapshot de flujo (P15d / motor).
 * Sin snapshot → comportamiento EST clásico (capitán recibe y cierra).
 */

/** Actor de cierre reconocible en el motor. */
export type WorkPermitCloseActor = "prevention" | "captain";

/** Etapa mínima del snapshot (JSON congelado). */
export type FlowSnapshotStage = {
  key: string;
  label?: string;
  position?: number;
  actor: string;
  moment?: string;
  requiresSignature?: boolean;
  mandatory?: boolean;
};

/** Snapshot mínimo. */
export type FlowSnapshot = {
  id?: string;
  code?: string;
  name?: string;
  stages: FlowSnapshotStage[];
};

/** Quién hace qué según el flujo congelado. */
export type WorkPermitFlowPolicy = {
  /** Hay etapa de recepción a bordo (capitán). */
  hasReceiveStage: boolean;
  /** Hay etapa explícita de pedir cierre. */
  hasRequestCloseStage: boolean;
  /** Quién cierra el trabajo. */
  closeActor: WorkPermitCloseActor;
};

/** ¿La clave parece recepción? */
function isReceiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === "receive" || k.includes("receive") || k.includes("recep");
}

/** ¿La clave parece pedido de cierre? */
function isRequestCloseKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === "request_close" ||
    k.includes("request_close") ||
    k.includes("pedir_cierre")
  );
}

/** ¿La clave parece cierre final? */
function isCloseKey(key: string): boolean {
  const k = key.toLowerCase();
  if (isRequestCloseKey(k)) return false;
  return (
    k === "close" ||
    k === "cierra" ||
    k === "captain_close" ||
    k.includes("close") ||
    k.includes("cierre") ||
    k.includes("cierra")
  );
}

/**
 * ¿Esta etapa es el cierre final del trabajo?
 * Regla producto: todo flujo (EST o personalizado) debe tener al menos una.
 */
export function isFinalCloseStage(stage: {
  key: string;
  actor: string;
  moment?: string | null;
}): boolean {
  if (isCloseKey(stage.key)) return true;
  if (isRequestCloseKey(stage.key) && stage.actor === "prevention") return true;
  if (
    stage.moment === "on_finish" &&
    (stage.actor === "prevention" || stage.actor === "captain")
  ) {
    return true;
  }
  return false;
}

/** ¿El listado de etapas incluye un cierre final? */
export function flowHasFinalCloseStage(
  stages: ReadonlyArray<{
    key: string;
    actor: string;
    moment?: string | null;
  }>,
): boolean {
  return stages.some((s) => isFinalCloseStage(s));
}

/**
 * Inicio / solicitud (aviso de trabajos).
 * Área solicitante o claves notice/aviso/solicitud.
 * No cuenta cierres (p. ej. request_close de Prevención).
 */
export function isStartOrRequestStage(stage: {
  key: string;
  actor: string;
  moment?: string | null;
}): boolean {
  if (isFinalCloseStage(stage)) return false;
  if (stage.actor === "requesting_area") return true;
  const k = stage.key.toLowerCase();
  return (
    k === "notice" ||
    k.includes("notice") ||
    k.includes("aviso") ||
    k.includes("solicitud") ||
    (k.includes("request") && !isRequestCloseKey(k))
  );
}

/**
 * Prevencionista en el flujo (no cierre): genera permiso, valida docs, etc.
 * Regla producto: al menos una etapa así en todo flujo.
 */
export function isPreventionApprovalStage(stage: {
  key: string;
  actor: string;
  moment?: string | null;
}): boolean {
  if (stage.actor !== "prevention") return false;
  if (isFinalCloseStage(stage)) return false;
  return true;
}

/**
 * Validación de documentos / aprobación por Prevención
 * (approve, validar…; no basta un intermedio de otra área).
 */
export function isPreventionDocumentValidationStage(stage: {
  key: string;
  actor: string;
  moment?: string | null;
}): boolean {
  if (!isPreventionApprovalStage(stage)) return false;
  const k = stage.key.toLowerCase();
  return (
    k === "approve" ||
    k.includes("approve") ||
    k.includes("aprob") ||
    k.includes("valid") ||
    k === "create_permit" ||
    k.includes("create_permit")
  );
}

/** Mínimo de etapas por flujo (inicio + Prevención + cierre). */
export const MIN_APPROVAL_FLOW_STAGES = 3;

/**
 * Cobertura mínima de roles de etapas.
 * Falta alguna → el flujo no es válido para operar un PT de punta a punta.
 */
export function resolveFlowStageCoverage(
  stages: ReadonlyArray<{
    key: string;
    actor: string;
    moment?: string | null;
  }>,
): {
  hasStart: boolean;
  hasPreventionApproval: boolean;
  hasClose: boolean;
  startCount: number;
  closeCount: number;
  ok: boolean;
} {
  const startCount = stages.filter((s) => isStartOrRequestStage(s)).length;
  const hasPreventionApproval = stages.some((s) =>
    isPreventionApprovalStage(s),
  );
  /** Debe haber validación/aprobación de docs por Prevencionista. */
  const hasPreventionDocumentValidation = stages.some((s) =>
    isPreventionDocumentValidationStage(s),
  );
  const closeCount = stages.filter((s) => isFinalCloseStage(s)).length;
  const hasStart = startCount >= 1;
  const hasClose = closeCount >= 1;
  return {
    hasStart,
    hasPreventionApproval: hasPreventionDocumentValidation,
    hasClose,
    startCount,
    closeCount,
    ok:
      stages.length >= MIN_APPROVAL_FLOW_STAGES &&
      hasStart &&
      hasPreventionDocumentValidation &&
      hasClose &&
      startCount === 1 &&
      closeCount === 1,
  };
}

/**
 * Deriva política del snapshot.
 * Sin etapas → EST: recibe y cierra el capitán.
 */
export function resolveWorkPermitFlowPolicy(
  snapshot: FlowSnapshot | null | undefined,
): WorkPermitFlowPolicy {
  const stages = snapshot?.stages ?? [];
  if (stages.length === 0) {
    return {
      hasReceiveStage: true,
      hasRequestCloseStage: true,
      closeActor: "captain",
    };
  }

  const hasReceiveStage = stages.some(
    (s) =>
      isReceiveKey(s.key) ||
      (s.actor === "captain" && s.moment === "on_arrival"),
  );

  /**
   * Pedido intermedio de cierre: solo si lo hace contratista/área.
   * Si la clave es request_close pero el actor es Prevención (label «cierra»),
   * es el cierre final del flujo, no un paso intermedio.
   */
  const hasRequestCloseStage = stages.some(
    (s) =>
      isRequestCloseKey(s.key) &&
      (s.actor === "contractor" || s.actor === "requesting_area"),
  );

  const closeStage =
    [...stages].reverse().find((s) => isCloseKey(s.key)) ??
    [...stages]
      .reverse()
      .find((s) => isRequestCloseKey(s.key) && s.actor === "prevention") ??
    [...stages]
      .reverse()
      .find((s) => s.moment === "on_finish" && s.actor !== "contractor");

  const closeActor: WorkPermitCloseActor =
    closeStage?.actor === "prevention" ? "prevention" : "captain";

  return {
    hasReceiveStage,
    hasRequestCloseStage,
    closeActor,
  };
}
