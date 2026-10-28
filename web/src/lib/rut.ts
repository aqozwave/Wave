/** Factores del dígito verificador chileno (módulo 11), de derecha a izquierda. */
const FACTORES = [2, 3, 4, 5, 6, 7] as const;

/**
 * Quita puntos y guiones y deja el formato canónico `12345678-9`.
 * Vacío o inválido de forma grosera → "".
 */
export function normalizeRut(rut: string): string {
  const cleaned = rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (cleaned.length < 2) return "";
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  return `${body}-${dv}`;
}

/**
 * True si el RUT/RUN tiene cuerpo numérico y dígito verificador correcto (módulo 11).
 * Acepta con o sin puntos/guión.
 */
export function isRutValid(rut: string): boolean {
  const normalized = normalizeRut(rut);
  if (!normalized) return false;

  const [body, dv] = normalized.split("-");
  if (!body || !dv) return false;
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let factorIndex = 0;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * FACTORES[factorIndex % FACTORES.length];
    factorIndex += 1;
  }

  const rest = 11 - (sum % 11);
  // 11 → 0, 10 → K, resto → el dígito.
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return dv.toUpperCase() === expected;
}
