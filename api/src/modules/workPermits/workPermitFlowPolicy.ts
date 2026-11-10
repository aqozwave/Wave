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
