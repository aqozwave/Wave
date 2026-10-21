import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Logo } from "../Logo/Logo";
import { SidebarItem } from "../SidebarItem/SidebarItem";

/** Iniciales a partir de nombre y apellido (máx. 2 letras). */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Sidebar Superadmin (Figma S1).
 * El pie de usuario abre el menú con “Cerrar sesión”.
 */
export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Menú del pie: abierto/cerrado al clic en la tarjeta de usuario.
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Usuario";
  const displayMeta = user ? `${user.internalRol} · v2.0` : "…";
  const initials = user
    ? initialsOf(user.firstName, user.lastName)
    : "?";

  /** Limpia la sesión en memoria y vuelve al login. */
  function onLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-nav-border)] bg-[var(--color-nav-bg)]">
      <div className="flex items-center justify-between py-[18px] pl-5 pr-3">
        <Logo size="sidebar" />
        <button
          type="button"
          className="flex size-[30px] items-center justify-center rounded-lg text-[var(--color-nav-icon)] hover:bg-[var(--color-nav-item-active-bg)]"
          aria-label="Contraer menú"
        >
          <PanelLeftClose size={18} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-2">
        <SidebarItem label="Panel" icon={LayoutDashboard} active />
        <div className="h-1.5" aria-hidden />
        <SidebarItem label="Tripulación" icon={Users} expandable />
        <SidebarItem label="Cursos" icon={GraduationCap} count={6} expandable />
        <SidebarItem label="Prevención" icon={HardHat} expandable />
        <SidebarItem label="Configuración" icon={Settings} expandable />
        <SidebarItem label="Sistema" icon={ShieldCheck} expandable />
      </nav>

      <div className="relative border-t border-[var(--color-nav-border)] p-3">
        {menuOpen ? (
          <div
            className="mb-2 overflow-hidden rounded-[10px] border border-[var(--color-nav-border)] bg-white py-1 shadow-sm"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[var(--color-nachipa-body)] hover:bg-[var(--color-nav-item-active-bg)]"
            >
              <LogOut size={16} strokeWidth={1.5} aria-hidden />
              Cerrar sesión
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-[var(--color-nav-item-active-bg)]"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-status-info-bg)] text-[12px] font-semibold text-[var(--color-status-info-fg)]">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium capitalize text-[var(--color-nav-user-name)]">
              {displayName}
            </span>
            <span className="block truncate text-[12px] capitalize text-[var(--color-nav-user-meta)]">
              {displayMeta}
            </span>
          </span>
          {menuOpen ? (
            <ChevronUp
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-[var(--color-nav-icon)]"
              aria-hidden
            />
          ) : (
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-[var(--color-nav-icon)]"
              aria-hidden
            />
          )}
        </button>
      </div>
    </aside>
  );
}
