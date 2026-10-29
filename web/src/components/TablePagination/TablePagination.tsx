import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Tamaños de página del pie Figma. */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type Props = {
  /** Texto a la izquierda (ej. «18 áreas» o «Total empresas: 2»). */
  totalLabel: string;
  /** Página actual (1-based). */
  page: number;
  /** Total de páginas (≥ 1). */
  pageCount: number;
  /** Ítems por página. */
  pageSize: number;
  /** Cambia de página. */
  onPageChange: (page: number) => void;
  /** Cambia el tamaño de página. */
  onPageSizeChange: (size: number) => void;
  /** Oculta el selector de tamaño (pie compacto tipo Flota). */
  hidePageSize?: boolean;
};

/**
 * Pie de DataTable (Figma TablePagination).
 * Total a la izquierda; ítems/página + prev/next a la derecha.
 */
export function TablePagination({
  totalLabel,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hidePageSize = false,
}: Props) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, pageCount));

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-[var(--color-nachipa-border-subtle,#efeff1)] bg-[var(--color-nachipa-bg-subtle,#f4f4f5)] px-4">
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-[18px] text-[var(--color-nachipa-title)]">
        {totalLabel}
      </p>

      {!hidePageSize ? (
        <>
          <span className="hidden shrink-0 text-[12px] leading-[18px] text-[var(--color-nachipa-secondary)] sm:inline">
            Ítems por página
          </span>
          <select
            className="h-8 w-[72px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] text-[var(--color-nachipa-body)] outline-none"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Ítems por página"
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white text-[var(--color-icon-default)] hover:bg-white disabled:opacity-40"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
      </button>

      <span className="shrink-0 tabular-nums text-[12px] leading-[18px] text-[var(--color-nachipa-secondary)]">
        {safePage} / {Math.max(1, pageCount)}
      </span>

      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white text-[var(--color-icon-default)] hover:bg-white disabled:opacity-40"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
        aria-label="Página siguiente"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Paginación client-side para listas ya filtradas.
 * Resetea a página 1 si cambian items o pageSize.
 */
export function useClientTablePagination<T>(
  items: readonly T[],
  initialPageSize = 10,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    total: items.length,
  };
}
