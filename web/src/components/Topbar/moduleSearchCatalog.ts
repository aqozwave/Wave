import type { AuthUser } from "../../lib/api/auth";
import { userHasPermission } from "../../lib/api/auth";

/** Destino navegable del buscador de módulos del topbar. */
export type ModuleSearchItem = {
  /** Id estable para keys de React. */
  id: string;
  /** Nombre visible en el resultado. */
  label: string;
  /** Grupo (Tripulación, Cursos, Configuración…) para contexto. */
  group: string;
  /** Ruta React Router (puede llevar query). */
  to: string;
  /** Sinónimos / palabras clave para filtrar (además de label y group). */
  keywords: readonly string[];
  /** Visibilidad según el mismo criterio que el sidebar. */
  canShow: (user: AuthUser | null) => boolean;
};

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
 * Catálogo de módulos/pantallas buscables.
 * Solo rutas existentes; Prevención se agrega cuando tenga home propia.
 */
export const MODULE_SEARCH_CATALOG: readonly ModuleSearchItem[] = [
  {
    id: "panel",
    label: "Panel / Inicio",
    group: "Inicio",
    to: "/",
    keywords: ["dashboard", "inicio", "home", "kpi", "nave"],
    canShow: (u) => u?.internalRol !== "contratista" && u?.internalRol !== "user",
  },
  {
    id: "home-contratista",
    label: "Panel del contratista",
    group: "Inicio",
    to: "/",
    keywords: ["habilitación", "permisos", "personal"],
    canShow: (u) => u?.internalRol === "contratista",
  },
  {
    id: "home-tripulante",
    label: "Inicio tripulante",
    group: "Inicio",
    to: "/",
    keywords: ["mis cursos", "libreta", "perfil"],
    canShow: (u) => u?.internalRol === "user",
  },
  {
    id: "embarcados",
    label: "Embarcados",
    group: "Tripulación",
    to: "/embarcados",
    keywords: ["tripulantes", "tripulación", "crew", "personas"],
    canShow: (u) => userHasPermission(u, "embarcados", "read"),
  },
  {
    id: "cursos-home",
    label: "Cursos — Presentación",
    group: "Cursos",
    to: "/cursos",
    keywords: ["formación", "omi", "hub"],
    canShow: (u) => canSeeCursosModule(u),
  },
  {
    id: "cursos-catalog",
    label: "Gestión de cursos",
    group: "Cursos",
    to: "/catalogos?tab=courses",
    keywords: ["catálogo", "omi", "cursos"],
    canShow: (u) => userHasPermission(u, "cursos.catalog", "read"),
  },
  {
    id: "cursos-certificates",
    label: "Cursos por título marítimo",
    group: "Cursos",
    to: "/catalogos?tab=certificates",
    keywords: ["certificados", "títulos", "obligatorios"],
    canShow: (u) => userHasPermission(u, "maestros.certificates", "read"),
  },
  {
    id: "cursos-tripulacion",
    label: "Cursos tripulación",
    group: "Cursos",
    to: "/cursos/tripulacion",
    keywords: ["matriz", "asignaciones"],
    canShow: (u) => userHasPermission(u, "cursos.assignments", "read"),
  },
  {
    id: "cursos-vencimientos",
    label: "Vencimientos / libretas",
    group: "Cursos",
    to: "/cursos/vencimientos",
    keywords: ["libreta", "embarcación", "vigencia"],
    canShow: (u) => userHasPermission(u, "cursos.libretas", "read"),
  },
  {
    id: "notificaciones",
    label: "Notificaciones de vencimiento",
    group: "Cursos",
    to: "/notificaciones",
    keywords: ["avisos", "hitos", "digest"],
    canShow: (u) => userHasPermission(u, "cursos.notifications", "read"),
  },
  {
    id: "outbox",
    label: "Outbox de notificaciones",
    group: "Cursos",
    to: "/notificaciones/outbox",
    keywords: ["cola", "correos", "envíos"],
    canShow: (u) => userHasPermission(u, "cursos.notifications", "read"),
  },
  {
    id: "empresas",
    label: "Empresas",
    group: "Configuración",
    to: "/empresas",
    keywords: ["tenants", "compañías"],
    canShow: (u) =>
      u?.internalRol === "superadmin" || u?.internalRol === "admin",
  },
  {
    id: "flota",
    label: "Flota y operación",
    group: "Configuración",
    to: "/ubicaciones",
    keywords: ["naves", "lugares", "áreas", "muelles", "puertos"],
    canShow: (u) => userHasPermission(u, "maestros.locations", "read"),
  },
  {
    id: "catalogos",
    label: "Catálogos maestros",
    group: "Configuración",
    to: "/catalogos",
    keywords: ["rangos", "títulos", "documentos", "maestros"],
    canShow: (u) => canSeeCatalogos(u),
  },
  {
    id: "usuarios",
    label: "Usuarios",
    group: "Configuración",
    to: "/usuarios",
    keywords: ["cuentas", "acceso", "rrhh"],
    canShow: (u) => userHasPermission(u, "maestros.users", "read"),
  },
  {
    id: "roles",
    label: "Roles y permisos",
    group: "Sistema",
    to: "/roles",
    keywords: ["rbac", "permisos"],
    canShow: (u) => u?.internalRol === "superadmin",
  },
  {
    id: "actividad",
    label: "Registro de actividad",
    group: "Sistema",
    to: "/sistema/actividad",
    keywords: ["auditoría", "logs"],
    canShow: (u) => u?.internalRol === "superadmin",
  },
];

/**
 * Filtra el catálogo por usuario + texto libre.
 * Query vacío: todos los módulos permitidos (lista al enfocar).
 */
export function filterModuleSearch(
  user: AuthUser | null,
  query: string,
): ModuleSearchItem[] {
  const allowed = MODULE_SEARCH_CATALOG.filter((item) => item.canShow(user));
  const q = query.trim().toLowerCase();
  if (!q) return [...allowed];
  return allowed.filter((item) => {
    const hay = [item.label, item.group, ...item.keywords]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
