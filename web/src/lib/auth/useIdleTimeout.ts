import { useEffect, useRef } from "react";

/**
 * 1 hora sin actividad del usuario → se considera sesión idle.
 * Valor de producto (Portal Nachipa); no acortar en local sin pedirlo.
 */
export const IDLE_MS = 60 * 60 * 1000;

/** Eventos que cuentan como “actividad” para reiniciar el timer. */
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "click",
] as const;

/** Mínimo entre resets por mousemove (evita martillar el timer). */
const MOUSEMOVE_THROTTLE_MS = 1000;

/**
 * Si `enabled`, arranca un timer de `idleMs`.
 * Cualquier actividad lo reinicia; al vencer llama `onIdle` una vez.
 */
export function useIdleTimeout(
  enabled: boolean,
  onIdle: () => void,
  idleMs: number = IDLE_MS,
): void {
  // Ref estable: el efecto no se re-suscribe solo porque cambió la identidad de onIdle.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timerId = 0;
    let lastMousemoveReset = 0;

    /** Programa (o reprograma) el cierre por inactividad. */
    function arm() {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        onIdleRef.current();
      }, idleMs);
    }

    /** Reinicia el timer ante actividad del usuario. */
    function onActivity(event: Event) {
      if (event.type === "mousemove") {
        const now = Date.now();
        if (now - lastMousemoveReset < MOUSEMOVE_THROTTLE_MS) {
          return;
        }
        lastMousemoveReset = now;
      }
      arm();
    }

    arm();

    for (const name of ACTIVITY_EVENTS) {
      // capture: scroll/click en hijos; passive: no bloquea el scroll.
      window.addEventListener(name, onActivity, { capture: true, passive: true });
    }

    return () => {
      window.clearTimeout(timerId);
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity, { capture: true });
      }
    };
  }, [enabled, idleMs]);
}
