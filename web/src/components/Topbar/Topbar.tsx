import { Bell, CircleHelp, LayoutDashboard, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type TopbarProps = {
  /** Texto del breadcrumb (estilo neutro del Figma Topbar). */
  breadcrumb: string;
  breadcrumbIcon?: LucideIcon;
  /** Dot rojo en notificaciones, como en el diseño. */
  hasNotifications?: boolean;
  actions?: ReactNode;
};

// Topbar Figma (2:442): blanco/neutro. Sin botón primary ni fondos de color.
export function Topbar({
  breadcrumb,
  breadcrumbIcon: BreadcrumbIcon = LayoutDashboard,
  hasNotifications = true,
  actions,
}: TopbarProps) {
  return (
    <header className="flex h-14 w-full shrink-0 items-center gap-3 bg-[var(--color-tremor-background)] px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BreadcrumbIcon
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--color-nachipa-body)]"
          aria-hidden
        />
        <p className="truncate text-[13px] font-medium text-[var(--color-nachipa-body)]">
          {breadcrumb}
        </p>
      </div>

      <label className="flex h-8 w-[240px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] pl-3 pr-2.5">
        <input
          type="search"
          placeholder="Buscar…"
          className="w-full bg-transparent text-[12px] leading-[18px] text-[var(--color-nachipa-title)] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
        />
        <Search
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--color-nav-icon)]"
          aria-hidden
        />
      </label>

      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] text-[var(--color-icon-default)]"
        aria-label="Ayuda"
      >
        <CircleHelp size={16} strokeWidth={1.5} aria-hidden />
      </button>

      <button
        type="button"
        className="relative flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] text-[var(--color-icon-default)]"
        aria-label="Notificaciones"
      >
        <Bell size={16} strokeWidth={1.5} aria-hidden />
        {hasNotifications ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--color-status-danger-fg)]"
          />
        ) : null}
      </button>

      {actions}
    </header>
  );
}
