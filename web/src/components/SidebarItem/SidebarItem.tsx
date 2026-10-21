import { ChevronRight, type LucideIcon } from "lucide-react";

type SidebarItemProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  count?: number;
  /** Grupo expandible: muestra chevron a la derecha (Figma Sidebar/Superadmin). */
  expandable?: boolean;
};

export function SidebarItem({
  label,
  icon: Icon,
  active = false,
  count,
  expandable = false,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={[
        "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
        active
          ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
          : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
      ].join(" ")}
    >
      <Icon
        size={18}
        strokeWidth={1.5}
        className={
          active
            ? "text-[var(--color-nav-item-active-fg)]"
            : "text-[var(--color-nav-icon)]"
        }
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === "number" ? (
        <span className="flex items-center rounded-full bg-[var(--color-status-info-bg)] px-[7px] py-px text-[11px] font-medium leading-4 text-[var(--color-status-info-fg)]">
          {count}
        </span>
      ) : null}
      {expandable ? (
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--color-nav-icon)]"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
