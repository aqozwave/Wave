/**
 * Exporta filas a CSV y dispara descarga en el navegador.
 * Sin dependencias: UTF-8 con BOM para Excel en Windows.
 */

/** Una columna del CSV: clave en el row + título de encabezado. */
export type CsvColumn<T> = {
  header: string;
  /** Valor de la celda (string/number/boolean/null). */
  value: (row: T) => string | number | boolean | null | undefined;
};

/** Escapa un valor para CSV (comillas si hace falta). */
function escapeCsvCell(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Convierte un valor de celda a texto plano. */
function cellToString(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

/**
 * Arma el contenido CSV (con BOM) y descarga el archivo.
 * @param filename sin extensión o con .csv
 */
export function downloadCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  filename: string,
): void {
  const headerLine = columns
    .map((col) => escapeCsvCell(col.header))
    .join(",");
  const bodyLines = rows.map((row) =>
    columns
      .map((col) => escapeCsvCell(cellToString(col.value(row))))
      .join(","),
  );
  const csv = `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeName = filename.toLowerCase().endsWith(".csv")
    ? filename
    : `${filename}.csv`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
