import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  ClipboardList,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../lib/auth/AuthContext";
import { Logo } from "../Logo/Logo";
import { SidebarItem } from "../SidebarItem/SidebarItem";

/** Clave localStorage para recordar si el menú está contraído. */
const COLLAPSED_KEY = "wave.sidebar.collapsed";

/** Ancho expandido (Figma Sidebar 256px). */
const WIDTH_OPEN = 256;
/** Ancho rail (Figma Menú contraído 72px). */
const WIDTH_COLLAPSED = 72;

/** Subítems de Tripulación (Figma Sidebar: solo Embarcados). */
const CREW_LINKS: ReadonlyArray<{
  label: string;
  to: string | null;
  icon: LucideIcon;
}> = [{ label: "Embarcados", to: "/embarcados", icon: Ship }];

/** Subítems de Configuración (Figma Sidebar Superadmin). */
const CONFIG_LINKS: ReadonlyArray<{
  label: string;
  to: string | null;
  icon: LucideIcon;
}> = [
  { label: "Resumen", to: null, icon: LayoutGrid },
  { label: "Empresas", to: "/empresas", icon: Building2 },
  /** Lugares de trabajo (naves, oficinas, etc.). */
  { label: "Flota y operación", to: "/ubicaciones", icon: MapPin },
  { label: "Catálogos maestros", to: "/catalogos", icon: ClipboardList },
  { label: "Usuarios", to: "/usuarios", icon: Users },
  { label: "Notificaciones", to: null, icon: Bell },
];

/** Iniciales a partir de nombre y apellido. */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Lee el estado persistido del rail. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Sidebar Superadmin (Figma).
 * Empresas vive dentro del grupo Configuración (no como ítem suelto).
 */
export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  /** Rutas bajo Configuración: mantienen el grupo abierto. */
  const onConfigSection =
    location.pathname.startsWith("/empresas") ||
    location.pathname.startsWith("/ubicaciones") ||
    location.pathname.startsWith("/catalogos") ||
    location.pathname.startsWith("/usuarios");
  /** Rutas bajo Tripulación (lista + ficha). */
  const onCrewSection = location.pathname.startsWith("/embarcados");
  /** Rutas bajo Sistema (Figma). */
  const onSystemSection = location.pathname.startsWith("/roles");
  const onPanel = location.pathname === "/";
  const [crewOpen, setCrewOpen] = useState(onCrewSection);
  const [configOpen, setConfigOpen] = useState(onConfigSection);
  const [systemOpen, setSystemOpen] = useState(onSystemSection);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setReady(true);
  }, []);

  useEffect(() => {
    if (onCrewSection) {
      setCrewOpen(true);
    }
  }, [onCrewSection]);

  useEffect(() => {
    if (onConfigSection) {
      setConfigOpen(true);
    }
  }, [onConfigSection]);

  useEffect(() => {
    if (onSystemSection) {
      setSystemOpen(true);
    }
  }, [onSystemSection]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Usuario";
  const displayMeta = user ? `${user.internalRol} · v2.0` : "…";
  const initials = user ? initialsOf(user.firstName, user.lastName) : "?";
  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_OPEN;

  return (
    <aside
      className={[
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--color-nav-border)] bg-[var(--color-nav-bg)]",
        "transition-[width] duration-300 ease-out",
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
              to="/"
              active={onPanel}
              collapsed
            />
            <div className="h-1.5" aria-hidden />
            <SidebarItem
              label="Tripulación"
              icon={Users}
              to="/embarcados"
              active={onCrewSection}
              collapsed
            />
            <SidebarItem
              label="Cursos"
              icon={GraduationCap}
              count={6}
              collapsed
            />
            <SidebarItem label="Prevención" icon={HardHat} collapsed />
            <SidebarItem
              label="Configuración"
              icon={Settings}
              to="/empresas"
              active={onConfigSection}
              collapsed
            />
            <SidebarItem
              label="Sistema"
              icon={ShieldCheck}
              to="/roles"
              active={onSystemSection}
              collapsed
            />
          </nav>

          <div className="flex justify-center border-t border-[var(--color-nav-border)] p-3">
            {user?.photoProfile ? (
              <img
                src={user.photoProfile}
                alt=""
                title={displayName}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex size-8 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[12px] font-semibold text-[var(--color-status-info-fg)]"
                title={displayName}
              >
                {initials}
              </span>
            )}
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
            <SidebarItem
              label="Panel"
              icon={LayoutDashboard}
              to="/"
              active={onPanel}
            />
            <div className="h-1.5" aria-hidden />

            {/* Grupo Tripulación (Figma): Embarcados. */}
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => setCrewOpen((v) => !v)}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
                  onCrewSection || crewOpen
                    ? "font-medium text-[var(--color-nav-item-active-fg)]"
                    : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                ].join(" ")}
                aria-expanded={crewOpen}
              >
                <Users
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">Tripulación</span>
                <span
                  className={[
                    "inline-flex size-3.5 shrink-0 text-[var(--color-nav-icon)] transition-transform",
                    crewOpen ? "rotate-90" : "",
                  ].join(" ")}
                  aria-hidden
                >
                  <svg viewBox="0 0 14 14" className="size-3.5" fill="none">
                    <path
                      d="M5 3.5 8.5 7 5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              {crewOpen ? (
                <div className="animate-submenu-enter mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-[var(--color-nav-border)] pl-1.5">
                  {CREW_LINKS.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.to !== null &&
                      location.pathname.startsWith(item.to);
                    const rowClass = [
                      "relative flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[13px] leading-[18px]",
                      active
                        ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
                        : "text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                    ].join(" ");
                    const content = (
                      <>
                        {active ? (
                          <span
                            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--color-nachipa-primary)]"
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          size={14}
                          strokeWidth={1.5}
                          className="shrink-0 text-[var(--color-nav-icon)]"
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </>
                    );
                    if (item.to) {
                      return (
                        <Link
                          key={item.label}
                          to={item.to}
                          aria-current={active ? "page" : undefined}
                          className={rowClass}
                        >
                          {content}
                        </Link>
                      );
                    }
                    return (
                      <span
                        key={item.label}
                        className={`${rowClass} cursor-default text-[var(--color-nachipa-muted)]`}
                        title="Próximamente"
                      >
                        {content}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <SidebarItem
              label="Cursos"
              icon={GraduationCap}
              count={6}
              expandable
            />
            <SidebarItem label="Prevención" icon={HardHat} expandable />

            {/* Grupo Configuración (Figma): Empresas es subítem. */}
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => setConfigOpen((v) => !v)}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
                  onConfigSection || configOpen
                    ? "font-medium text-[var(--color-nav-item-active-fg)]"
                    : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                ].join(" ")}
                aria-expanded={configOpen}
              >
                <Settings
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">Configuración</span>
                <span
                  className={[
                    "inline-flex size-3.5 shrink-0 text-[var(--color-nav-icon)] transition-transform",
                    configOpen ? "rotate-90" : "",
                  ].join(" ")}
                  aria-hidden
                >
                  <svg viewBox="0 0 14 14" className="size-3.5" fill="none">
                    <path
                      d="M5 3.5 8.5 7 5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              {configOpen ? (
                <div className="animate-submenu-enter mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-[var(--color-nav-border)] pl-1.5">
                  {CONFIG_LINKS.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.to !== null &&
                      location.pathname.startsWith(item.to);
                    const rowClass = [
                      "relative flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[13px] leading-[18px]",
                      active
                        ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
                        : "text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                    ].join(" ");
                    const content = (
                      <>
                        {active ? (
                          <span
                            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--color-nachipa-primary)]"
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          size={14}
                          strokeWidth={1.5}
                          className="shrink-0 text-[var(--color-nav-icon)]"
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </>
                    );
                    if (item.to) {
                      return (
                        <Link
                          key={item.label}
                          to={item.to}
                          aria-current={active ? "page" : undefined}
                          className={rowClass}
                        >
                          {content}
                        </Link>
                      );
                    }
                    return (
                      <span
                        key={item.label}
                        className={`${rowClass} cursor-default text-[var(--color-nachipa-muted)]`}
                        title="Próximamente"
                      >
                        {content}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Grupo Sistema (Figma): Roles y permisos. */}
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => setSystemOpen((v) => !v)}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
                  onSystemSection || systemOpen
                    ? "font-medium text-[var(--color-nav-item-active-fg)]"
                    : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                ].join(" ")}
                aria-expanded={systemOpen}
              >
                <ShieldCheck
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">Sistema</span>
                <span
                  className={[
                    "inline-flex size-3.5 shrink-0 text-[var(--color-nav-icon)] transition-transform",
                    systemOpen ? "rotate-90" : "",
                  ].join(" ")}
                  aria-hidden
                >
                  <svg viewBox="0 0 14 14" className="size-3.5" fill="none">
                    <path
                      d="M5 3.5 8.5 7 5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              {systemOpen ? (
                <div className="animate-submenu-enter mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-[var(--color-nav-border)] pl-1.5">
                  <Link
                    to="/roles"
                    aria-current={onSystemSection ? "page" : undefined}
                    className={[
                      "relative flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[13px] leading-[18px]",
                      onSystemSection
                        ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
                        : "text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                    ].join(" ")}
                  >
                    {onSystemSection ? (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--color-nachipa-primary)]"
                        aria-hidden
                      />
                    ) : null}
                    <ShieldCheck
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 text-[var(--color-nav-icon)]"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">Roles y permisos</span>
                  </Link>
                  <span
                    className="relative flex h-8 cursor-default items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[13px] leading-[18px] text-[var(--color-nachipa-muted)]"
                    title="Próximamente"
                  >
                    <ClipboardList
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 text-[var(--color-nav-icon)]"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">
                      Registro de actividad
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="border-t border-[var(--color-nav-border)] p-3">
            <div className="flex w-full items-center gap-2.5 rounded-[10px] p-2">
              {user?.photoProfile ? (
                <img
                  src={user.photoProfile}
                  alt=""
                  className="size-8 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-status-info-bg)] text-[12px] font-semibold text-[var(--color-status-info-fg)]">
                  {initials}
                </span>
              )}
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
