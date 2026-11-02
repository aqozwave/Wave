import { CircleHelp, LayoutDashboard, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SystemAnnouncementsBell } from "../SystemAnnouncementsBell/SystemAnnouncementsBell";

type TopbarProps = {
  /** Texto del breadcrumb (estilo neutro del Figma Topbar). */
  breadcrumb: string;
  breadcrumbIcon?: LucideIcon;
  /**
   * @deprecated La campanita ahora usa unreadCount real de avisos de sistema.
   * Se ignora; se deja por compatibilidad de llamadas existentes.
   */
  hasNotifications?: boolean;
  actions?: ReactNode;
};

/**
 * Topbar breadcrumb (Figma 2:442 / S5).
 * Sin fondo blanco ni borde: hereda el gris de la página (#f9fafc).
 */
export function Topbar({
  breadcrumb,
  breadcrumbIcon: BreadcrumbIcon = LayoutDashboard,
  actions,
}: TopbarProps) {
  return (
    <header className="flex h-[72px] w-full shrink-0 items-center gap-3 bg-transparent px-6">
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

      <SystemAnnouncementsBell />

      {actions}
    </header>
  );
}
