import type { ReactNode } from "react";
import { Search } from "lucide-react";

type Props = {
  /** Controles h32 dentro de la tarjeta (search, filtros, export). */
  toolbar?: ReactNode;
  /** `<table>` u otro contenido scrolleable. */
  children: ReactNode;
  /** Pie (TablePagination u otro). */
  footer?: ReactNode;
};

/**
 * Contenedor DataTable Figma: card blanca, toolbar interna, scroll, pie.
 */
export function DataTableCard({ toolbar, children, footer }: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
      {toolbar ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-tremor-border)] px-4 py-3">
          {toolbar}
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-3 pt-2">
        {children}
      </div>
      {footer}
    </div>
  );
}

/** Input search compacto h32 para toolbars de DataTable. */
export function DataTableSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3">
      <Search
        className="size-3.5 shrink-0 text-[var(--color-icon-default)]"
        strokeWidth={1.5}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
      />
    </label>
  );
}

/** Select compacto h32 para filtros de toolbar. */
export function DataTableSelect({
  value,
  onChange,
  children,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  "aria-label": string;
  className?: string;
}) {
  return (
    <select
      className={
        className ??
        "h-8 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] text-[var(--color-nachipa-body)] outline-none"
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      {children}
    </select>
  );
}

/** Botón outline h32 (Exportar, etc.). */
export function DataTableOutlineButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
