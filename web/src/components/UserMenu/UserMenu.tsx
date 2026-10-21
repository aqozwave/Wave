import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";

/** Iniciales a partir de nombre y apellido (máx. 2 letras). */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * Menú de usuario del header del Panel (Figma S1 · Header → Usuario).
 * Avatar + chevron; dropdown con Cerrar sesión.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = user
    ? initialsOf(user.firstName, user.lastName)
    : "?";

  /** Cierra sesión local (+ API si responde) y vuelve al login. */
  async function onLogout() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-1.5 hover:bg-[var(--color-nav-item-active-bg)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de usuario"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex size-8 items-center justify-center rounded-2xl border-2 border-white bg-[var(--color-kpi-indigo-soft)] text-[12px] font-semibold text-[var(--color-kpi-indigo)]">
          {initials}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="text-[var(--color-nav-icon)]"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 min-w-[180px] overflow-hidden rounded-[10px] border border-[var(--color-nav-border)] bg-white py-1 shadow-sm"
          role="menu"
        >
          {user ? (
            <div className="border-b border-[var(--color-nav-border)] px-3 py-2">
              <p className="truncate text-[13px] font-medium capitalize text-[var(--color-nav-user-name)]">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[12px] capitalize text-[var(--color-nav-user-meta)]">
                {user.internalRol}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[var(--color-nachipa-body)] hover:bg-[var(--color-nav-item-active-bg)]"
          >
            <LogOut size={16} strokeWidth={1.5} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
