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

/** ¿Puede ver el módulo Prevención? */
function canSeePrevencionModule(user: AuthUser | null): boolean {
  return (
    userHasPermission(user, "permit_types", "read") ||
    userHasPermission(user, "trainings", "read") ||
    userHasPermission(user, "work_permits", "read") ||
    userHasPermission(user, "contractors", "read")
  );
}

/**
 * Catálogo de módulos/pantallas buscables.
 * Solo rutas existentes.
 */
export const MODULE_SEARCH_CATALOG: readonly ModuleSearchItem[] = [
  {
    id: "panel",
    label: "Panel / Inicio",
    group: "Inicio",
    to: "/",
    keywords: ["dashboard", "inicio", "home", "kpi", "nave"],
    canShow: (u) =>
      u?.internalRol !== "contratista" &&
      u?.internalRol !== "contratista_faena" &&
      u?.internalRol !== "user",
  },
  {
    id: "home-contratista",
    label: "Panel del contratista",
    group: "Inicio",
    to: "/",
    keywords: ["habilitación", "permisos", "personal"],
    canShow: (u) =>
      u?.internalRol === "contratista" ||
      u?.internalRol === "contratista_faena",
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
    id: "prevencion-home",
    label: "Prevención — Presentación",
    group: "Prevención",
    to: "/prevencion",
    keywords: ["riesgos", "permisos", "hub", "hard hat"],
    canShow: (u) => canSeePrevencionModule(u),
  },
  {
    id: "prevencion-tipos",
    label: "Tipos de permiso",
    group: "Prevención",
    to: "/prevencion/tipos",
    keywords: ["cal", "alt", "ecf", "permit types", "checklist"],
    /** Catálogo de tipos: gestionar (update), no solo read de selects. */
    canShow: (u) => userHasPermission(u, "permit_types", "update"),
  },
  {
    id: "prevencion-capacitaciones",
    label: "Capacitaciones",
    group: "Prevención",
    to: "/prevencion/capacitaciones",
    keywords: ["trainings", "ext-01", "odi", "inducción"],
    canShow: (u) => userHasPermission(u, "trainings", "read"),
  },
  {
    id: "prevencion-capacitaciones-sesiones",
    label: "Sesiones de capacitación",
    group: "Prevención",
    to: "/prevencion/capacitaciones/sesiones",
    keywords: [
      "sesión",
      "grupal",
      "individual",
      "acta",
      "dictar",
      "capacitación",
    ],
    canShow: (u) => userHasPermission(u, "trainings", "read"),
  },
  {
    id: "prevencion-packs",
    label: "Packs de habilitación",
    group: "Prevención",
    to: "/prevencion/packs",
    keywords: ["pack", "habilitación", "empresa", "persona", "acreditación"],
    canShow: (u) =>
      userHasPermission(u, "accreditation_packs", "read"),
  },
  {
    id: "config-contratistas",
    label: "Contratistas",
    group: "Configuración",
    to: "/prevencion/contratistas",
    keywords: ["organizaciones", "externas", "RUT", "habilitación", "portal"],
    canShow: (u) => userHasPermission(u, "contractors", "read"),
  },
  {
    id: "prevencion-habilitaciones",
    label: "Habilitaciones",
    group: "Prevención",
    to: "/prevencion/habilitaciones",
    keywords: ["HAB", "acreditación", "docs", "aprobar"],
    canShow: (u) => userHasPermission(u, "accreditations", "read"),
  },
  {
    id: "notificaciones",
    label: "Notificaciones de vencimiento",
    group: "Sistema",
    to: "/notificaciones",
    keywords: ["avisos", "hitos", "digest"],
    canShow: (u) => userHasPermission(u, "cursos.notifications", "read"),
  },
  {
    id: "outbox",
    label: "Outbox de notificaciones",
    group: "Sistema",
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
    id: "flujos-aprobacion",
    label: "Flujos de aprobación",
    group: "Configuración",
    to: "/configuracion/flujos",
    keywords: ["EST", "etapas", "permiso de trabajo", "P16"],
    canShow: (u) => userHasPermission(u, "approval_flows", "read"),
  },
  {
    id: "usuarios",
    label: "Usuarios",
    group: "Sistema",
    to: "/usuarios",
    keywords: ["cuentas", "acceso", "rrhh", "invitados internos"],
    canShow: (u) => userHasPermission(u, "maestros.users", "read"),
  },
  {
    id: "roles",
    label: "Roles y permisos",
    group: "Sistema",
    to: "/roles",
    keywords: ["rbac", "permisos"],
    canShow: (u) => userHasPermission(u, "roles", "read"),
  },
  {
    id: "actividad",
    label: "Bitácora",
    group: "Sistema",
    to: "/sistema/actividad",
    keywords: ["auditoría", "logs", "registro de actividad"],
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
