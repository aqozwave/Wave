import { useEffect, useState } from "react";
import {
  GraduationCap,
  HardHat,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Logo } from "../Logo/Logo";
import { SidebarItem } from "../SidebarItem/SidebarItem";

/** Clave localStorage para recordar si el menú está contraído. */
const COLLAPSED_KEY = "wave.sidebar.collapsed";

/** Ancho expandido (Figma Sidebar 256px). */
const WIDTH_OPEN = 256;
/** Ancho rail (Figma Abierto=Menú contraído 72px). */
const WIDTH_COLLAPSED = 72;

/** Iniciales a partir de nombre y apellido (máx. 2 letras). */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Lee el estado persistido del rail; default abierto. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Sidebar Superadmin (Figma S1 · 133:4571 + variante Menú contraído 188:13140).
 * Animación de ancho al contraer/expandir; entrada suave al montar el shell.
 */
export function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  // Evita hidratar con valor de localStorage en SSR/mismatch; aplica tras mount.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setReady(true);
  }, []);

  /** Alterna rail ↔ menú completo y persiste la preferencia. */
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage bloqueado: igual actualizamos el estado en memoria.
      }
      return next;
    });
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Usuario";
  const displayMeta = user ? `${user.internalRol} · v2.0` : "…";
  const initials = user
    ? initialsOf(user.firstName, user.lastName)
    : "?";

  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_OPEN;

  return (
    <aside
      className={[
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--color-nav-border)] bg-[var(--color-nav-bg)]",
        "transition-[width] duration-300 ease-out",
        // Tras leer localStorage: entrada suave; antes, oculto para no saltar el ancho.
        ready ? "animate-sidebar-enter" : "opacity-0",
      ].join(" ")}
      style={{ width }}
      aria-label="Navegación principal"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {collapsed ? (
        <>
          <div className="flex flex-col items-center gap-3 px-2 pb-2 pt-[18px]">
            <Logo size="mark" />
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nav-icon)] hover:bg-[var(--color-nav-item-active-bg)]"
              aria-label="Expandir menú"
              title="Expandir menú"
            >
              <PanelLeft size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto px-2 pt-1">
            <SidebarItem
              label="Panel"
              icon={LayoutDashboard}
              active
              collapsed
            />
            <div className="h-1.5" aria-hidden />
            <SidebarItem label="Tripulación" icon={Users} collapsed />
            <SidebarItem
              label="Cursos"
              icon={GraduationCap}
              count={6}
              collapsed
            />
            <SidebarItem label="Prevención" icon={HardHat} collapsed />
            <SidebarItem label="Configuración" icon={Settings} collapsed />
            <SidebarItem label="Sistema" icon={ShieldCheck} collapsed />
          </nav>

          <div className="flex justify-center border-t border-[var(--color-nav-border)] p-3">
            <span
              className="flex size-8 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[12px] font-semibold text-[var(--color-status-info-fg)]"
              title={displayName}
            >
              {initials}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between py-[18px] pl-5 pr-3">
            <Logo size="sidebar" />
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex size-[30px] items-center justify-center rounded-lg text-[var(--color-nav-icon)] hover:bg-[var(--color-nav-item-active-bg)]"
              aria-label="Contraer menú"
              title="Contraer menú"
            >
              <PanelLeftClose size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-2">
            <SidebarItem label="Panel" icon={LayoutDashboard} active />
            <div className="h-1.5" aria-hidden />
            <SidebarItem label="Tripulación" icon={Users} expandable />
            <SidebarItem
              label="Cursos"
              icon={GraduationCap}
              count={6}
              expandable
            />
            <SidebarItem label="Prevención" icon={HardHat} expandable />
            <SidebarItem label="Configuración" icon={Settings} expandable />
            <SidebarItem label="Sistema" icon={ShieldCheck} expandable />
          </nav>

          <div className="border-t border-[var(--color-nav-border)] p-3">
            <div className="flex w-full items-center gap-2.5 rounded-[10px] p-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-status-info-bg)] text-[12px] font-semibold text-[var(--color-status-info-fg)]">
                {initials}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block truncate text-[13px] font-medium capitalize text-[var(--color-nav-user-name)]">
                  {displayName}
                </span>
                <span className="block truncate text-[12px] capitalize text-[var(--color-nav-user-meta)]">
                  {displayMeta}
                </span>
              </span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
