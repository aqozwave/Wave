import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import type { ReactNode } from "react";

/** Props de un ítem del sidebar (expandido o rail contraído). */
type SidebarItemProps = {
  /** Texto visible solo cuando el menú está abierto. */
  label: string;
  icon: LucideIcon;
  /** Ítem de la ruta actual (fondo gris suave). */
  active?: boolean;
  /** Badge numérico; en rail se muestra como punto rojo. */
  count?: number;
  /** Grupo expandible: chevron a la derecha (solo menú abierto). */
  expandable?: boolean;
  /** Modo Figma “Menú contraído”: solo ícono centrado. */
  collapsed?: boolean;
  /** Ruta React Router; si hay, el ítem es un Link. */
  to?: string;
};

/**
 * Ítem de navegación del Sidebar (Figma SidebarItem).
 * En rail contraído oculta label/chevron y reduce el count a un punto.
 */
export function SidebarItem({
  label,
  icon: Icon,
  active = false,
  count,
  expandable = false,
  collapsed = false,
  to,
}: SidebarItemProps) {
  const hasCount = typeof count === "number" && count > 0;

  /** Clases del control (button o Link). */
  const collapsedClass = [
    "relative flex size-9 items-center justify-center rounded-[var(--radius-md)]",
    active
      ? "bg-[var(--color-nav-item-active-bg)] text-[var(--color-nav-item-active-fg)]"
      : "text-[var(--color-nav-icon)] hover:bg-[var(--color-nav-item-active-bg)]",
  ].join(" ");

  const openClass = [
    "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
    active
      ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
      : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
  ].join(" ");

  /** Contenido interno compartido (ícono + label + extras). */
  function inner(collapsedMode: boolean): ReactNode {
    if (collapsedMode) {
      return (
        <>
          <Icon size={18} strokeWidth={1.5} aria-hidden />
          {hasCount ? (
            <span
              className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--color-status-danger-fg)]"
              aria-hidden
            />
          ) : null}
        </>
      );
    }
    return (
      <>
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
        {hasCount ? (
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
      </>
    );
  }

  if (collapsed) {
    if (to) {
      return (
        <Link
          to={to}
          title={label}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={collapsedClass}
        >
          {inner(true)}
        </Link>
      );
    }
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={collapsedClass}
      >
        {inner(true)}
      </button>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={openClass}
      >
        {inner(false)}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={openClass}
    >
      {inner(false)}
    </button>
  );
}
