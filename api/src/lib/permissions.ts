/**
 * Catálogo RBAC (globales).
 * resource + actions. El alcance de datos vive en Role.dataScope.
 * Alineado al portal viejo + Wave (puertos).
 */

/** Acciones posibles por recurso. */
export const PERMISSION_ACTION = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DEACTIVATE: "deactivate",
} as const;

export const PERMISSION_ACTIONS = Object.values(PERMISSION_ACTION);

/** Claves estables usadas en seed, API y UI. */
export const PERMISSION_RESOURCE = {
  DASHBOARD: "dashboard",
  MAESTROS_USERS: "maestros.users",
  MAESTROS_BUSINESSES: "maestros.businesses",
  MAESTROS_LOCATIONS: "maestros.locations",
  MAESTROS_AREAS: "maestros.areas",
  MAESTROS_RANKS: "maestros.ranks",
  MAESTROS_DEGREES: "maestros.degrees",
  MAESTROS_CERTIFICATES: "maestros.certificates",
  MAESTROS_DOCUMENT_TYPES: "maestros.document_types",
  MAESTROS_PORTS: "maestros.ports",
  MAESTROS_MUELLES: "maestros.muelles",
  MAESTROS_TRAVESIAS: "maestros.travesias",
  EMBARCADOS: "embarcados",
  /**
   * Documentos del expediente (Figma S3 · Fila Documentos del expediente).
   * Ver=read, Crear=cargar/subir, Editar=update, Desactivar=quitar.
   */
  EMBARCADOS_DOCS: "embarcados.docs",
  CURSOS_CATALOG: "cursos.catalog",
  CURSOS_ASSIGNMENTS: "cursos.assignments",
  CURSOS_ASSIGNMENTS_ASSIGN: "cursos.assignments.assign",
  CURSOS_LIBRETAS: "cursos.libretas",
  CURSOS_NOTIFICATIONS: "cursos.notifications",
  PREVENCION: "prevencion",
  PREVENCION_DOCS: "prevencion.docs",
  ROLES: "roles",
} as const;

export const PERMISSION_RESOURCES = Object.values(PERMISSION_RESOURCE);

/** Una fila del catálogo UI (checkboxes). */
export type PermissionCatalogItem = {
  resource: string;
  label: string;
  actions: readonly string[];
  hint?: string;
};

/** Grupo de módulos del catálogo. */
export type PermissionCatalogModule = {
  module: string;
  items: PermissionCatalogItem[];
};

/**
 * Metadatos para UI de checkboxes (agrupados por módulo).
 * No implica que el rol los tenga: solo el catálogo disponible.
 */
export const PERMISSION_CATALOG: PermissionCatalogModule[] = [
  {
    module: "General",
    items: [
      {
        resource: PERMISSION_RESOURCE.DASHBOARD,
        label: "Dashboard",
        actions: [PERMISSION_ACTION.READ],
      },
    ],
  },
  {
    module: "Maestros",
    items: [
      {
        resource: PERMISSION_RESOURCE.MAESTROS_USERS,
        label: "Usuarios",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_BUSINESSES,
        label: "Empresas",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_LOCATIONS,
        label: "Naves / lugar de trabajo",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_AREAS,
        label: "Áreas",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_RANKS,
        label: "Rangos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_DEGREES,
        label: "Títulos académicos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_CERTIFICATES,
        label: "Títulos marítimos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES,
        label: "Tipos de documento",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_PORTS,
        label: "Puertos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_MUELLES,
        label: "Muelles",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.MAESTROS_TRAVESIAS,
        label: "Travesías",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.EMBARCADOS,
        label: "Embarcados",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.EMBARCADOS_DOCS,
        label: "Documentos del expediente",
        hint: "Ver y subir · Prevencionista y Administrador",
        actions: PERMISSION_ACTIONS,
      },
    ],
  },
  {
    module: "Cursos",
    items: [
      {
        resource: PERMISSION_RESOURCE.CURSOS_CATALOG,
        label: "Catálogo de cursos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
        label: "Cursos por tripulante",
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.UPDATE,
          PERMISSION_ACTION.DEACTIVATE,
        ],
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS_ASSIGN,
        label: "Asignar cursos a tripulantes",
        hint: "Check opcional (ej. capitán / colaborador).",
        actions: [PERMISSION_ACTION.CREATE],
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_LIBRETAS,
        label: "Libretas de embarque",
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
        label: "Notificaciones de vencimiento",
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
    ],
  },
  {
    module: "Prevención de riesgos",
    items: [
      {
        resource: PERMISSION_RESOURCE.PREVENCION,
        label: "Módulo prevención",
        actions: [PERMISSION_ACTION.READ],
      },
      {
        resource: PERMISSION_RESOURCE.PREVENCION_DOCS,
        label: "Documentos (contratistas)",
        actions: PERMISSION_ACTIONS,
      },
    ],
  },
  {
    module: "Sistema",
    items: [
      {
        resource: PERMISSION_RESOURCE.ROLES,
        label: "Roles y permisos",
        actions: PERMISSION_ACTIONS,
      },
    ],
  },
];

/**
 * Alcances de datos en Wave (Prisma RoleDataScope).
 * self ≈ “Externo” del portal viejo / Figma.
 */
export const ROLE_DATA_SCOPE = {
  ALL: "all",
  BUSINESS: "business",
  LOCATION: "location",
  AREA: "area",
  SELF: "self",
} as const;

export const ROLE_DATA_SCOPES = Object.values(ROLE_DATA_SCOPE);

/** Claves de roles de sistema (seed; Figma S3 + RR.HH. para scopes de docs). */
export const SYSTEM_ROLE_KEY = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  /** Recursos humanos; tag de documento `hr` (uploadBy/viewBy = hr). */
  RRHH: "rrhh",
  /** Prevención de riesgos; tag de documento `prevention`. */
  PREVENCIONISTA: "prevencionista",
  /** Activos / área técnica; tag de documento `assets`. */
  AREA_TECNICA: "area_tecnica",
  USER: "user",
  COLABORADOR: "colaborador",
  CONTRATISTA: "contratista",
} as const;

export const SYSTEM_ROLE_KEYS = Object.values(SYSTEM_ROLE_KEY);

/** Todas las acciones de un recurso. */
function allActions(resource: string) {
  return { resource, actions: [...PERMISSION_ACTIONS] };
}

/** Solo lectura. */
function readOnly(resource: string) {
  return { resource, actions: [PERMISSION_ACTION.READ] };
}

/** Definición de seed: roles globales de sistema. */
export const SYSTEM_ROLE_DEFS = [
  {
    key: SYSTEM_ROLE_KEY.SUPERADMIN,
    name: "Superadmin",
    description: "Acceso total al sistema y gestión de roles.",
    dataScope: ROLE_DATA_SCOPE.ALL,
    permissions: PERMISSION_RESOURCES.map((resource) => allActions(resource)),
  },
  {
    key: SYSTEM_ROLE_KEY.ADMIN,
    name: "Administrador",
    description: "Administra su empresa: maestros, cursos y usuarios del tenant.",
    dataScope: ROLE_DATA_SCOPE.BUSINESS,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      allActions(PERMISSION_RESOURCE.MAESTROS_USERS),
      allActions(PERMISSION_RESOURCE.MAESTROS_LOCATIONS),
      allActions(PERMISSION_RESOURCE.MAESTROS_AREAS),
      allActions(PERMISSION_RESOURCE.MAESTROS_RANKS),
      allActions(PERMISSION_RESOURCE.MAESTROS_DEGREES),
      allActions(PERMISSION_RESOURCE.MAESTROS_CERTIFICATES),
      allActions(PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES),
      allActions(PERMISSION_RESOURCE.MAESTROS_PORTS),
      allActions(PERMISSION_RESOURCE.MAESTROS_MUELLES),
      allActions(PERMISSION_RESOURCE.MAESTROS_TRAVESIAS),
      allActions(PERMISSION_RESOURCE.EMBARCADOS),
      /** Figma: Ver y subir · Administrador. */
      allActions(PERMISSION_RESOURCE.EMBARCADOS_DOCS),
      allActions(PERMISSION_RESOURCE.CURSOS_CATALOG),
      allActions(PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS),
      {
        resource: PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS_ASSIGN,
        actions: [PERMISSION_ACTION.CREATE],
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_LIBRETAS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
      {
        resource: PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
      readOnly(PERMISSION_RESOURCE.PREVENCION),
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.RRHH,
    name: "RR.HH.",
    description:
      "Recursos humanos: gestiona embarcados y documentos de alcance RR.HH.",
    dataScope: ROLE_DATA_SCOPE.BUSINESS,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      allActions(PERMISSION_RESOURCE.EMBARCADOS),
      allActions(PERMISSION_RESOURCE.EMBARCADOS_DOCS),
      allActions(PERMISSION_RESOURCE.MAESTROS_USERS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_LOCATIONS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_AREAS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_RANKS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_DEGREES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_CERTIFICATES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_MUELLES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_TRAVESIAS),
      readOnly(PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS),
      readOnly(PERMISSION_RESOURCE.CURSOS_LIBRETAS),
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.PREVENCIONISTA,
    name: "Prevencionista",
    description:
      "Gestiona embarcados y prevención en su empresa (alta, edición, docs).",
    dataScope: ROLE_DATA_SCOPE.BUSINESS,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      /** CRUD completo de tripulantes embarcados. */
      allActions(PERMISSION_RESOURCE.EMBARCADOS),
      /** Figma: Ver y subir · Prevencionista. */
      allActions(PERMISSION_RESOURCE.EMBARCADOS_DOCS),
      allActions(PERMISSION_RESOURCE.PREVENCION),
      allActions(PERMISSION_RESOURCE.PREVENCION_DOCS),
      /** Catálogos de solo lectura para selects de ficha/alta. */
      readOnly(PERMISSION_RESOURCE.MAESTROS_LOCATIONS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_AREAS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_RANKS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_CERTIFICATES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_MUELLES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_TRAVESIAS),
      readOnly(PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS),
      readOnly(PERMISSION_RESOURCE.CURSOS_LIBRETAS),
      {
        resource: PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.AREA_TECNICA,
    name: "Área Técnica",
    description:
      "Activos / área técnica: consulta y edición de embarcados y docs.",
    dataScope: ROLE_DATA_SCOPE.BUSINESS,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      {
        resource: PERMISSION_RESOURCE.EMBARCADOS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
      {
        resource: PERMISSION_RESOURCE.EMBARCADOS_DOCS,
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
        ],
      },
      readOnly(PERMISSION_RESOURCE.MAESTROS_LOCATIONS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_AREAS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_RANKS),
      readOnly(PERMISSION_RESOURCE.MAESTROS_DOCUMENT_TYPES),
      readOnly(PERMISSION_RESOURCE.MAESTROS_CERTIFICATES),
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.USER,
    name: "User (tripulante)",
    description: "Usuario de una nave: consulta acotada a su location.",
    dataScope: ROLE_DATA_SCOPE.LOCATION,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      readOnly(PERMISSION_RESOURCE.EMBARCADOS),
      /** Solo ver los docs que crewCanView permita en el API. */
      readOnly(PERMISSION_RESOURCE.EMBARCADOS_DOCS),
      readOnly(PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS),
      readOnly(PERMISSION_RESOURCE.CURSOS_LIBRETAS),
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.COLABORADOR,
    name: "Colaborador",
    description:
      "Supervisor de nave: valida certificados de su tripulación.",
    dataScope: ROLE_DATA_SCOPE.LOCATION,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      readOnly(PERMISSION_RESOURCE.EMBARCADOS),
      readOnly(PERMISSION_RESOURCE.EMBARCADOS_DOCS),
      {
        resource: PERMISSION_RESOURCE.CURSOS_ASSIGNMENTS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
      readOnly(PERMISSION_RESOURCE.CURSOS_LIBRETAS),
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.CONTRATISTA,
    name: "Contratista",
    description:
      "Proveedor: sube documentos de prevención (módulo futuro).",
    dataScope: ROLE_DATA_SCOPE.SELF,
    permissions: [
      readOnly(PERMISSION_RESOURCE.DASHBOARD),
      readOnly(PERMISSION_RESOURCE.PREVENCION),
      {
        resource: PERMISSION_RESOURCE.PREVENCION_DOCS,
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
        ],
      },
    ],
  },
] as const;
