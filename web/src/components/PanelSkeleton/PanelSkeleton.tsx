import { Skeleton } from "../Skeleton/Skeleton";

/**
 * Placeholder del Panel mientras hidrata la sesión (/me).
 * Misma estructura gruesa que KPIs + tabla para no saltar el layout.
 */
export function PanelSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-6 overflow-auto px-7 py-[22px]"
      role="status"
      aria-busy="true"
      aria-label="Cargando panel"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5"
          >
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
          <Skeleton className="mb-4 h-5 w-44" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
