import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CircleHelp, LayoutDashboard, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../lib/auth/AuthContext";
import { SystemAnnouncementsBell } from "../SystemAnnouncementsBell/SystemAnnouncementsBell";
import {
  filterModuleSearch,
  type ModuleSearchItem,
} from "./moduleSearchCatalog";

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

/** Máximo de resultados visibles en el dropdown. */
const MAX_RESULTS = 8;

/**
 * Topbar breadcrumb (Figma 2:442 / S5).
 * Buscador: módulos/pantallas permitidos por el rol del usuario.
 */
export function Topbar({
  breadcrumb,
  breadcrumbIcon: BreadcrumbIcon = LayoutDashboard,
  actions,
}: TopbarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => filterModuleSearch(user, query).slice(0, MAX_RESULTS),
    [user, query],
  );

  /** Cierra el panel al click fuera. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  /** Resetea el índice activo cuando cambian los resultados. */
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  /** Navega al módulo elegido y limpia el campo. */
  function goTo(item: ModuleSearchItem) {
    navigate(item.to);
    setQuery("");
    setOpen(false);
  }

  /** Teclado: flechas, Enter, Escape. */
  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      (event.target as HTMLInputElement).blur();
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) goTo(item);
    }
  }

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

      <div ref={rootRef} className="relative w-[240px] shrink-0">
        <label className="flex h-8 w-full items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] pl-3 pr-2.5">
          <input
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && results[activeIndex]
                ? `${listId}-${results[activeIndex].id}`
                : undefined
            }
            placeholder="Buscar módulo…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onSearchKeyDown}
            className="w-full bg-transparent text-[12px] leading-[18px] text-[var(--color-nachipa-title)] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
          />
          <Search
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--color-nav-icon)]"
            aria-hidden
          />
        </label>

        {open ? (
          <div
            id={listId}
            role="listbox"
            className="absolute right-0 z-50 mt-1 max-h-[320px] w-[300px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] py-1 shadow-sm"
          >
            {results.length === 0 ? (
              <p className="m-0 px-3 py-2 text-[12px] text-[var(--color-nachipa-secondary)]">
                Sin módulos que coincidan con tu búsqueda o permisos.
              </p>
            ) : (
              results.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goTo(item)}
                    className={[
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                      active
                        ? "bg-[var(--color-nav-item-active-bg)]"
                        : "hover:bg-[var(--color-nav-item-active-bg)]",
                    ].join(" ")}
                  >
                    <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-[var(--color-nachipa-secondary)]">
                      {item.group}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

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
