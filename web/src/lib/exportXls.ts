/**
 * Exporta filas a Excel XML 2003 (.xls) y dispara la descarga.
 * Sin dependencias: SpreadsheetML lo abre Excel / LibreOffice / Numbers.
 */

/** Una columna del export: título + valor por fila. */
export type XlsColumn<T> = {
  header: string;
  /** Valor de la celda (string/number/boolean/null). */
  value: (row: T) => string | number | boolean | null | undefined;
};

/** Escapa texto para XML. */
function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte un valor de celda a texto plano. */
function cellToString(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

/** True si el valor debe ir tipado como Number en Excel. */
function isNumericValue(
  value: string | number | boolean | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Arma una celda SpreadsheetML. */
function xlsCell(
  value: string | number | boolean | null | undefined,
): string {
  if (isNumericValue(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  const text = escapeXml(cellToString(value));
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
}

/**
 * Arma el XML .xls y descarga el archivo.
 * @param filename sin extensión o con .xls
 */
export function downloadXls<T>(
  rows: readonly T[],
  columns: readonly XlsColumn<T>[],
  filename: string,
): void {
  const headerRow = `<Row>${columns.map((col) => xlsCell(col.header)).join("")}</Row>`;
  const bodyRows = rows
    .map((row) => {
      const cells = columns.map((col) => xlsCell(col.value(row))).join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?mso-application progid="Excel.Sheet"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:o="urn:schemas-microsoft-com:office:office"`,
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"`,
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:html="http://www.w3.org/TR/REC-html40">`,
    `<Worksheet ss:Name="Datos">`,
    `<Table>`,
    headerRow,
    bodyRows,
    `</Table>`,
    `</Worksheet>`,
    `</Workbook>`,
  ].join("");

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const safeName = filename.toLowerCase().endsWith(".xls")
    ? filename
    : `${filename}.xls`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
