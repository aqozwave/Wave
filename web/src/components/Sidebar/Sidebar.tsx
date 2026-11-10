import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HardHat,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  GitBranch,
  Package,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { userHasPermission, type AuthUser } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";
import { Logo } from "../Logo/Logo";
import { SidebarItem } from "../SidebarItem/SidebarItem";

/** Clave localStorage para recordar si el menú está contraído. */
const COLLAPSED_KEY = "wave.sidebar.collapsed";

/** Ancho expandido (Figma Sidebar 256px). */
const WIDTH_OPEN = 256;
/** Ancho rail (Figma Menú contraído 72px). */
const WIDTH_COLLAPSED = 72;

/** Ítem de menú con permiso mínimo (resource + action) o null = siempre visible. */
type NavLink = {
  label: string;
  to: string | null;
  icon: LucideIcon;
  /** Si falta, el ítem no se muestra (salvo superadmin vía userHasPermission). */
  canShow: (user: AuthUser | null) => boolean;
};

/** Subítems de Tripulación (Figma: solo Embarcados). */
const CREW_LINKS: ReadonlyArray<NavLink> = [
  {
    label: "Embarcados",
    to: "/embarcados",
    icon: Ship,
    canShow: (u) => userHasPermission(u, "embarcados", "read"),
  },
];

/**
 * Subítems de Cursos: solo pantallas propias del módulo.
 * Catálogos y Embarcados viven en Configuración / Tripulación (sin duplicar).
 */
const CURSOS_LINKS: ReadonlyArray<NavLink> = [
  {
    label: "Presentación",
    to: "/cursos",
    icon: GraduationCap,
    canShow: (u) => canSeeCursosModule(u),
  },
  {
    label: "Cursos tripulación",
    to: "/cursos/tripulacion",
    icon: ClipboardList,
    canShow: (u) => userHasPermission(u, "cursos.assignments", "read"),
  },
  {
    label: "Vencimientos",
    to: "/cursos/vencimientos",
    icon: AlertTriangle,
    canShow: (u) => userHasPermission(u, "cursos.libretas", "read"),
  },
  {
    label: "Notificaciones",
    to: "/notificaciones",
    icon: Bell,
    canShow: (u) => userHasPermission(u, "cursos.notifications", "read"),
  },
  {
    label: "Outbox",
    to: "/notificaciones/outbox",
    icon: Inbox,
    canShow: (u) => userHasPermission(u, "cursos.notifications", "read"),
  },
];

/** ¿Puede abrir el módulo Cursos (alguno de sus recursos)? */
function canSeeCursosModule(user: AuthUser | null): boolean {
  return (
    userHasPermission(user, "cursos.assignments", "read") ||
    userHasPermission(user, "cursos.libretas", "read") ||
    userHasPermission(user, "cursos.notifications", "read") ||
    userHasPermission(user, "cursos.catalog", "read")
  );
}

/** ¿Puede ver Catálogos maestros (tabs de maestros o catálogo OMI)? */
function canSeeCatalogos(user: AuthUser | null): boolean {
  return (
    userHasPermission(user, "cursos.catalog", "read") ||
    userHasPermission(user, "maestros.ranks", "read") ||
    userHasPermission(user, "maestros.degrees", "read") ||
    userHasPermission(user, "maestros.certificates", "read") ||
    userHasPermission(user, "maestros.document_types", "read")
  );
}

/**
 * Recursos de Prevención con read → mostrar el grupo.
 * Stub viejo prevencion / prevencion.docs reemplazado por recursos finos (P0).
 */
const PREVENCION_MENU_RESOURCES = [
  "contractors",
  "accreditations",
  "work_notices",
  "work_permits",
  "permit_types",
  "trainings",
  "accreditation_packs",
] as const;

/** ¿Puede ver el grupo Prevención? */
function canSeePrevencion(user: AuthUser | null): boolean {
  return PREVENCION_MENU_RESOURCES.some((resource) =>
    userHasPermission(user, resource, "read"),
  );
}

/**
 * Subítems de Prevención en orden de proceso:
 * operación (contratista → HAB → aviso → PT) y después catálogos.
 */
const PREVENCION_LINKS: ReadonlyArray<NavLink> = [
  {
    label: "Presentación",
    to: "/prevencion",
    icon: HardHat,
    canShow: (u) => canSeePrevencion(u),
  },
  {
    label: "Habilitaciones",
    to: "/prevencion/habilitaciones",
    icon: ClipboardCheck,
    canShow: (u) => userHasPermission(u, "accreditations", "read"),
  },
  {
    label: "Avisos de trabajo",
    to: "/prevencion/avisos",
    icon: Bell,
    canShow: (u) => userHasPermission(u, "work_notices", "read"),
  },
  {
    label: "Permisos de trabajo",
    to: "/prevencion/permisos",
    icon: ShieldCheck,
    canShow: (u) => userHasPermission(u, "work_permits", "read"),
  },
  {
    label: "Tipos de permiso",
    to: "/prevencion/tipos",
    icon: ClipboardList,
    /** read solo alimenta selects (avisos); el catálogo pide gestionar. */
    canShow: (u) => userHasPermission(u, "permit_types", "update"),
  },
  {
    label: "Capacitaciones",
    to: "/prevencion/capacitaciones",
    icon: GraduationCap,
    canShow: (u) => userHasPermission(u, "trainings", "read"),
  },
  {
    label: "Packs de habilitación",
    to: "/prevencion/packs",
    icon: Package,
    canShow: (u) =>
      userHasPermission(u, "accreditation_packs", "read"),
  },
];

/** Activo exacto en Presentación; prefijo en subrutas. */
function isPrevencionNavActive(
  to: string | null,
  pathname: string,
): boolean {
  if (!to) return false;
  if (to === "/prevencion") return pathname === "/prevencion";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** ¿Ruta de maestro Contratistas (vive en Configuración, URL legacy bajo /prevencion)? */
function isContractorsConfigPath(pathname: string): boolean {
  return (
    pathname === "/prevencion/contratistas" ||
    pathname.startsWith("/prevencion/contratistas/")
  );
}

/** Subítems de Configuración (sin Notificaciones: viven bajo Cursos). */
const CONFIG_LINKS: ReadonlyArray<NavLink> = [
  {
    label: "Resumen",
    to: null,
    icon: LayoutGrid,
    canShow: () => false,
  },
  {
    label: "Empresas",
    to: "/empresas",
    icon: Building2,
    canShow: (u) =>
      u?.internalRol === "superadmin" || u?.internalRol === "admin",
  },
  {
    label: "Contratistas",
    to: "/prevencion/contratistas",
    icon: Building2,
    canShow: (u) => userHasPermission(u, "contractors", "read"),
  },
  {
    label: "Flota y operación",
    to: "/ubicaciones",
    icon: MapPin,
    canShow: (u) => userHasPermission(u, "maestros.locations", "read"),
  },
  {
    label: "Catálogos maestros",
    to: "/catalogos",
    icon: ClipboardList,
    canShow: (u) => canSeeCatalogos(u),
  },
  {
    label: "Flujos de aprobación",
    to: "/configuracion/flujos",
    icon: GitBranch,
    /** P16 · approval_flows:read (Admin / Superadmin / rol custom). */
    canShow: (u) => userHasPermission(u, "approval_flows", "read"),
  },
];

/**
 * Subítems de Sistema: cuentas internas (+ roles/bitácora solo superadmin).
 * Los invitados del portal contratista no viven acá (van en Contratistas).
 */
const SYSTEM_LINKS: ReadonlyArray<NavLink> = [
  {
    label: "Usuarios",
    to: "/usuarios",
    icon: Users,
    canShow: (u) => userHasPermission(u, "maestros.users", "read"),
  },
  {
    label: "Roles y permisos",
    to: "/roles",
    icon: ShieldCheck,
    canShow: (u) => u?.internalRol === "superadmin",
  },
  {
    label: "Bitácora",
    to: "/sistema/actividad",
    icon: ClipboardList,
    canShow: (u) => u?.internalRol === "superadmin",
  },
];

/** Iniciales a partir de nombre y apellido. */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/**
 * ¿El subítem de Cursos coincide con la URL actual?
 * Soporta rutas con query (?tab=courses).
 */
function isCursosNavActive(
  to: string | null,
  pathname: string,
  search: string,
): boolean {
  if (!to) return false;
  if (to.includes("?")) {
    const [path, query] = to.split("?");
    return pathname === path && search.includes(query);
  }
  if (to === "/cursos") return pathname === "/cursos";
  return pathname === to || pathname.startsWith(`${to}/`);
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
    location.pathname.startsWith("/configuracion") ||
    isContractorsConfigPath(location.pathname);
  /** Rutas bajo Tripulación (lista + ficha). */
  const onCrewSection = location.pathname.startsWith("/embarcados");
  /** Grupo Cursos: /cursos/* y avisos (no catálogos). */
  const onCursosSection =
    location.pathname.startsWith("/cursos") ||
    location.pathname.startsWith("/notificaciones");
  /** Grupo Prevención: operación HAB/avisos/PT (Contratistas va en Configuración). */
  const onPrevencionSection =
    location.pathname.startsWith("/prevencion") &&
    !isContractorsConfigPath(location.pathname);
  /** Rutas bajo Sistema (usuarios internos + roles/bitácora). */
  const onSystemSection =
    location.pathname.startsWith("/usuarios") ||
    location.pathname.startsWith("/roles") ||
    location.pathname.startsWith("/sistema");
  const onPanel = location.pathname === "/";
  /** Habilitación del portal contratista (E4). */
  const onPortalHab = location.pathname.startsWith("/portal/habilitacion");
  /** Mi personal del portal contratista (E5). */
  const onPortalPeople = location.pathname.startsWith("/portal/personal");
  /** Permisos del portal contratista (enviar a aprobación). */
  const onPortalPermits = location.pathname.startsWith("/portal/permisos");
  /**
   * Acordeón: un solo grupo padre abierto a la vez.
   * null = todos cerrados (p. ej. estás en Panel).
   */
  type NavGroupId =
    | "crew"
    | "cursos"
    | "prevencion"
    | "config"
    | "system";
  /** Grupo activo según la URL al montar. */
  function groupFromRoute(): NavGroupId | null {
    if (onCrewSection) return "crew";
    if (onCursosSection) return "cursos";
    if (onPrevencionSection) return "prevencion";
    if (onConfigSection) return "config";
    if (onSystemSection) return "system";
    return null;
  }
  const [openGroup, setOpenGroup] = useState<NavGroupId | null>(groupFromRoute);
  const crewOpen = openGroup === "crew";
  const cursosOpen = openGroup === "cursos";
  const prevencionOpen = openGroup === "prevencion";
  const configOpen = openGroup === "config";
  const systemOpen = openGroup === "system";
  /** Abre un padre y cierra el resto; si ya está abierto, lo cierra. */
  function toggleGroup(id: NavGroupId) {
    setOpenGroup((current) => (current === id ? null : id));
  }

  const visibleCrewLinks = CREW_LINKS.filter((item) => item.canShow(user));
  const visibleCursosLinks = CURSOS_LINKS.filter((item) => item.canShow(user));
  const visiblePrevencionLinks = PREVENCION_LINKS.filter((item) =>
    item.canShow(user),
  );
  const visibleConfigLinks = CONFIG_LINKS.filter((item) => item.canShow(user));
  const visibleSystemLinks = SYSTEM_LINKS.filter((item) => item.canShow(user));
  /** Usuario externo (P9b): menú portal E*, no el de la naviera. */
  const isContractorPortal = Boolean(user?.organizationId);
  /**
   * Faena: solo Panel + Permisos (sin HAB ni personal).
   * Dueño (`contratista`) ve el menú completo de Mi empresa.
   */
  const isContractorFaena = user?.internalRol === "contratista_faena";
  const showCrewGroup = !isContractorPortal && visibleCrewLinks.length > 0;
  const showCursosGroup = !isContractorPortal && visibleCursosLinks.length > 0;
  const showConfigGroup = !isContractorPortal && visibleConfigLinks.length > 0;
  const showPrevencion = !isContractorPortal && canSeePrevencion(user);
  /** Sistema: Usuarios (admin+) + Roles/Bitácora (superadmin). */
  const showSystemGroup =
    !isContractorPortal && visibleSystemLinks.length > 0;
  /** Etiqueta del home según rol (Figma C1 / T* / E3). */
  const panelLabel = isContractorPortal
    ? "Panel"
    : user?.internalRol === "colaborador"
      ? "Panel de mi nave"
      : user?.internalRol === "user"
        ? "Inicio"
        : "Panel";

  useEffect(() => {
    setCollapsed(readCollapsed());
    setReady(true);
  }, []);

  /** Al navegar, abre solo el grupo de la ruta actual (acordeón). */
  useEffect(() => {
    const next = groupFromRoute();
    if (next) setOpenGroup(next);
  }, [
    onCrewSection,
    onCursosSection,
    onPrevencionSection,
    onConfigSection,
    onSystemSection,
  ]);

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
  const displayMeta = user
    ? isContractorPortal
      ? `${isContractorFaena ? "Faena" : "Contratista"} · ${user.organization?.name ?? "org"}`
      : `${user.internalRol} · v2.0`
    : "…";
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
              label={panelLabel}
              icon={LayoutDashboard}
              to="/"
              active={onPanel}
              collapsed
            />
            {isContractorPortal ? (
              <>
                {!isContractorFaena ? (
                  <>
                    <SidebarItem
                      label="Habilitación"
                      icon={ClipboardCheck}
                      to="/portal/habilitacion"
                      active={onPortalHab}
                      collapsed
                    />
                    <SidebarItem
                      label="Mi personal"
                      icon={Users}
                      to="/portal/personal"
                      active={onPortalPeople}
                      collapsed
                    />
                  </>
                ) : null}
                <SidebarItem
                  label="Permisos"
                  icon={ClipboardList}
                  to="/portal/permisos"
                  active={onPortalPermits}
                  collapsed
                />
              </>
            ) : null}
            <div className="h-1.5" aria-hidden />
            {showCrewGroup ? (
              <SidebarItem
                label="Tripulación"
                icon={Users}
                to="/embarcados"
                active={onCrewSection}
                collapsed
              />
            ) : null}
            {showCursosGroup ? (
              <SidebarItem
                label="Cursos"
                icon={GraduationCap}
                to="/cursos"
                active={onCursosSection}
                collapsed
              />
            ) : null}
            {showPrevencion ? (
              <SidebarItem
                label="Prevención"
                icon={HardHat}
                to="/prevencion"
                active={onPrevencionSection}
                collapsed
              />
            ) : null}
            {showConfigGroup ? (
              <SidebarItem
                label="Configuración"
                icon={Settings}
                to={visibleConfigLinks[0]?.to ?? "/empresas"}
                active={onConfigSection}
                collapsed
              />
            ) : null}
            {showSystemGroup ? (
              <SidebarItem
                label="Sistema"
                icon={ShieldCheck}
                to={visibleSystemLinks[0]?.to ?? "/usuarios"}
                active={onSystemSection}
                collapsed
              />
            ) : null}
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
              label={panelLabel}
              icon={LayoutDashboard}
              to="/"
              active={onPanel}
            />
            {isContractorPortal ? (
              <>
                <p className="m-0 px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-nav-icon)]">
                  {isContractorFaena ? "Trabajos" : "Mi empresa"}
                </p>
                {!isContractorFaena ? (
                  <>
                    <SidebarItem
                      label="Habilitación"
                      icon={ClipboardCheck}
                      to="/portal/habilitacion"
                      active={onPortalHab}
                    />
                    <SidebarItem
                      label="Mi personal"
                      icon={Users}
                      to="/portal/personal"
                      active={onPortalPeople}
                    />
                  </>
                ) : null}
                <SidebarItem
                  label="Permisos"
                  icon={ClipboardList}
                  to="/portal/permisos"
                  active={onPortalPermits}
                />
              </>
            ) : null}
            <div className="h-1.5" aria-hidden />

            {/* Grupo Tripulación (Figma): Embarcados. */}
            {showCrewGroup ? (
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => toggleGroup("crew")}
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
                  {visibleCrewLinks.map((item) => {
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
            ) : null}

            {/* Grupo Cursos: solo pantallas propias del módulo. */}
            {showCursosGroup ? (
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => toggleGroup("cursos")}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
                  onCursosSection || cursosOpen
                    ? "font-medium text-[var(--color-nav-item-active-fg)]"
                    : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                ].join(" ")}
                aria-expanded={cursosOpen}
              >
                <GraduationCap
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">Cursos</span>
                <span
                  className={[
                    "inline-flex size-3.5 shrink-0 text-[var(--color-nav-icon)] transition-transform",
                    cursosOpen ? "rotate-90" : "",
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
              {cursosOpen ? (
                <div className="animate-submenu-enter mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-[var(--color-nav-border)] pl-1.5">
                  {visibleCursosLinks.map((item) => {
                    const Icon = item.icon;
                    const active = isCursosNavActive(
                      item.to,
                      location.pathname,
                      location.search,
                    );
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
            ) : null}

            {showPrevencion ? (
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => toggleGroup("prevencion")}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] pl-2.5 pr-2 text-left text-[13px] leading-[18px]",
                  onPrevencionSection || prevencionOpen
                    ? "font-medium text-[var(--color-nav-item-active-fg)]"
                    : "font-normal text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                ].join(" ")}
                aria-expanded={prevencionOpen}
              >
                <HardHat
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--color-nav-icon)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">Prevención</span>
                <span
                  className={[
                    "inline-flex size-3.5 shrink-0 text-[var(--color-nav-icon)] transition-transform",
                    prevencionOpen ? "rotate-90" : "",
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
              {prevencionOpen ? (
                <div className="animate-submenu-enter mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-[var(--color-nav-border)] pl-1.5">
                  {visiblePrevencionLinks.map((item) => {
                    const Icon = item.icon;
                    const active = isPrevencionNavActive(
                      item.to,
                      location.pathname,
                    );
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
            ) : null}

            {/* Grupo Configuración (Figma): Empresas es subítem. */}
            {showConfigGroup ? (
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => toggleGroup("config")}
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
                  {visibleConfigLinks.map((item) => {
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
            ) : null}

            {/* Grupo Sistema: Usuarios internos (+ roles/bitácora superadmin). */}
            {showSystemGroup ? (
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => toggleGroup("system")}
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
                  {visibleSystemLinks.map((item) => {
                    if (!item.to) return null;
                    const Icon = item.icon;
                    const active =
                      location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "relative flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[13px] leading-[18px]",
                          active
                            ? "bg-[var(--color-nav-item-active-bg)] font-medium text-[var(--color-nav-item-active-fg)]"
                            : "text-[var(--color-nav-text)] hover:bg-[var(--color-nav-item-active-bg)]",
                        ].join(" ")}
                      >
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
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
            ) : null}
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
