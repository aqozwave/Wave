/**
 * Fechas de calendario (sin hora): mediodía UTC del día indicado.
 * Evita desfases al comparar "YYYY-MM-DD" entre zonas.
 */
export function parseDateOnlyInput(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        12,
        0,
        0,
      ),
    );
  }

  const str = String(value).trim();
  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      12,
      0,
      0,
    ),
  );
}

/**
 * Clave numérica del día (UTC midnight ms).
 * Sirve para dedupeKey y para el cursor diario del digest admin.
 */
export function getDateOnlyKey(
  value: Date | string | null | undefined,
): number | null {
  const date = parseDateOnlyInput(value);
  if (!date) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
