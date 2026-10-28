/**
 * Estado de vigencia del libro de embarque (Figma Embarcados / Ficha).
 * Umbral “por vencer”: 30 días (mismo criterio UI del portal de referencia).
 */

/** Días antes del vencimiento para marcar “por vencer”. */
export const BOARDING_BOOK_WARNING_DAYS = 30;

/** Buckets de tab en Embarcados. */
export type BoardingBookTab = "all" | "vigente" | "por_vencer" | "vencido";

/** Estado visual de la libreta. */
export type BoardingBookUiState = "vigente" | "por_vencer" | "vencido";

/** Diferencia en días enteros (fecha válida − hoy UTC), o null si fecha inválida. */
export function daysUntilBoardingBookExpiry(
  iso: string | null | undefined,
  now = new Date(),
): number | null {
  if (!iso) return null;
  const until = new Date(iso);
  if (Number.isNaN(until.getTime())) return null;
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const target = Date.UTC(
    until.getUTCFullYear(),
    until.getUTCMonth(),
    until.getUTCDate(),
  );
  return Math.round((target - today) / 86_400_000);
}

/** Clasifica la libreta para chips y tabs. */
export function getBoardingBookUiState(
  iso: string | null | undefined,
  now = new Date(),
): BoardingBookUiState {
  const days = daysUntilBoardingBookExpiry(iso, now);
  if (days === null || days < 0) return "vencido";
  if (days <= BOARDING_BOOK_WARNING_DAYS) return "por_vencer";
  return "vigente";
}

/** Fecha corta DD-MM-YYYY. */
export function formatBoardingBookDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Etiqueta del chip de vigencia. */
export function boardingBookStateLabel(state: BoardingBookUiState): string {
  if (state === "vigente") return "Vigente";
  if (state === "por_vencer") return "Por vencer";
  return "Vencido";
}
