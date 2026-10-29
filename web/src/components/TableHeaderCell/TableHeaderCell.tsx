import type { ButtonHTMLAttributes, ReactNode, ThHTMLAttributes } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

/** Dirección de orden en columnas sortable. */
export type TableSortDir = "asc" | "desc" | null;

type Props = {
  /** Texto del encabezado. */
  children: ReactNode;
  /** Si true, muestra ícono de orden (Figma TableHeaderCell). */
  sortable?: boolean;
  /** Orden actual de esta columna (null = sin orden). */
  sortDir?: TableSortDir;
  /** Click para ciclar/ordenar; solo si sortable. */
  onSort?: () => void;
  /** Primera celda del header: radio izquierdo. */
  rounded?: "left" | "right" | "none";
  /** Alineación del contenido. */
  align?: "left" | "right";
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, "children" | "align">;

/**
 * Encabezado de DataTable (Figma TableHeaderCell).
 * Fondo gris, 12/semibold, sort opcional con Lucide.
 */
export function TableHeaderCell({
  children,
  sortable = false,
  sortDir = null,
  onSort,
  rounded = "none",
  align = "left",
  className,
  ...rest
}: Props) {
  const roundedClass =
    rounded === "left"
      ? "rounded-l-lg"
      : rounded === "right"
        ? "rounded-r-lg"
        : "";

  const content = sortable ? (
    <SortButton sortDir={sortDir} onClick={onSort}>
      {children}
    </SortButton>
  ) : (
    children
  );

  return (
    <th
      className={[
        "h-9 border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)] px-3 text-[12px] font-semibold leading-[18px] text-[var(--color-table-head-text,#6b6b73)]",
        align === "right" ? "text-right" : "text-left",
        roundedClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {content}
    </th>
  );
}

/** Botón de orden dentro del th. */
function SortButton({
  children,
  sortDir,
  onClick,
}: {
  children: ReactNode;
  sortDir: TableSortDir;
  onClick?: () => void;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5"
      onClick={onClick}
    >
      {children}
      {sortDir === "asc" ? (
        <ChevronUp className="size-3" strokeWidth={1.5} aria-hidden />
      ) : sortDir === "desc" ? (
        <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
      ) : (
        <ChevronsUpDown className="size-3" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}
