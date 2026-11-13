/**
 * Catálogo RBAC (globales).
 * resource + actions. El alcance de datos vive en Role.dataScope.
 * Prevención: recursos finos (P0); capa de módulos = RESOURCE_TO_MODULE_KEY.
 */

/** Acciones posibles por recurso. */
export const PERMISSION_ACTION = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DEACTIVATE: "deactivate",
  /** Solo work_permits: recibir / verificar cierre a bordo (capitán). */
  RECEIVE: "receive",
} as const;

/**
 * Acciones CRUD genéricas (sin receive).
 * receive no entra acá: solo en el ítem de catálogo de work_permits.
 */
export const PERMISSION_ACTIONS = [
  PERMISSION_ACTION.READ,
  PERMISSION_ACTION.CREATE,
  PERMISSION_ACTION.UPDATE,
  PERMISSION_ACTION.DEACTIVATE,
] as const;

/** Todas las acciones conocidas (CRUD + receive) para validación Zod/ETL. */
export const PERMISSION_ACTION_VALUES = Object.values(PERMISSION_ACTION);

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
  /**
   * Quién recibe los digests diarios de vencimiento (cursos + libreta).
   * Independiente de poder ver/gestionar el outbox en la UI.
   */
  CURSOS_NOTIFICATIONS_DIGEST: "cursos.notifications.digest",
  /** Empresas contratistas / organizaciones externas (módulo contractors). */
  CONTRACTORS: "contractors",
  /** Habilitaciones y documentos de contratistas (módulo contractors). */
  ACCREDITATIONS: "accreditations",
  /** Avisos de trabajo (solicitante con área → Prevención; módulo work_permits). */
  WORK_NOTICES: "work_notices",
  /** Permisos de trabajo (módulo work_permits). */
  WORK_PERMITS: "work_permits",
  /** Catálogo de tipos de permiso (módulo work_permits). */
  PERMIT_TYPES: "permit_types",
  /**
   * Plantillas de etapas de aprobación de PT (Configuración · Flujos).
   * CRUD de copias de empresa; EST de sistema no se edita.
   */
  APPROVAL_FLOWS: "approval_flows",
  /** Capacitaciones del módulo Prevención (no confundir con cursos OMI). */
  TRAININGS: "trainings",
  /**
   * Sesiones de capacitación (menú P1): dictado grupal/individual + acta.
   * Separado del catálogo trainings para poder ocultar sesiones sin quitar el maestro.
   */
  TRAINING_SESSIONS: "training_sessions",
  /**
   * Packs de habilitación (menú P1): qué document_types van en pack empresa/persona.
   * Separado de maestros.document_types para poder ocultar el menú sin quitar el catálogo.
   */
  ACCREDITATION_PACKS: "accreditation_packs",
  ROLES: "roles",
  /** Registro de actividad (Bitácora). Solo lectura. */
  SISTEMA_ACTIVITY_LOGS: "sistema.activity_logs",
} as const;

export const PERMISSION_RESOURCES = Object.values(PERMISSION_RESOURCE);

/**
 * Keys de BusinessModule (alineadas al enum Prisma BusinessModuleKey).
 * Base (tripulación/cursos) no aparece: siempre activo.
 */
export const BUSINESS_MODULE_KEY = {
  CONTRACTORS: "contractors",
  WORK_PERMITS: "work_permits",
  TRAININGS: "trainings",
} as const;

export const BUSINESS_MODULE_KEYS = Object.values(BUSINESS_MODULE_KEY);

/**
 * resource → submódulo de empresa.
 * null = recurso base (siempre on; no depende de business_modules).
 */
export const RESOURCE_TO_MODULE_KEY: Readonly<
  Record<string, (typeof BUSINESS_MODULE_KEYS)[number] | null>
> = {
  [PERMISSION_RESOURCE.CONTRACTORS]: BUSINESS_MODULE_KEY.CONTRACTORS,
  [PERMISSION_RESOURCE.ACCREDITATIONS]: BUSINESS_MODULE_KEY.CONTRACTORS,
  [PERMISSION_RESOURCE.WORK_NOTICES]: BUSINESS_MODULE_KEY.WORK_PERMITS,
  [PERMISSION_RESOURCE.WORK_PERMITS]: BUSINESS_MODULE_KEY.WORK_PERMITS,
  [PERMISSION_RESOURCE.PERMIT_TYPES]: BUSINESS_MODULE_KEY.WORK_PERMITS,
  [PERMISSION_RESOURCE.APPROVAL_FLOWS]: BUSINESS_MODULE_KEY.WORK_PERMITS,
  [PERMISSION_RESOURCE.TRAININGS]: BUSINESS_MODULE_KEY.TRAININGS,
  [PERMISSION_RESOURCE.TRAINING_SESSIONS]: BUSINESS_MODULE_KEY.TRAININGS,
  [PERMISSION_RESOURCE.ACCREDITATION_PACKS]: BUSINESS_MODULE_KEY.CONTRACTORS,
};

/** Recursos del módulo Prevención (menú / gate de UI). */
export const PREVENCION_RESOURCES = [
  PERMISSION_RESOURCE.CONTRACTORS,
  PERMISSION_RESOURCE.ACCREDITATIONS,
  PERMISSION_RESOURCE.WORK_NOTICES,
  PERMISSION_RESOURCE.WORK_PERMITS,
  PERMISSION_RESOURCE.PERMIT_TYPES,
  PERMISSION_RESOURCE.APPROVAL_FLOWS,
  PERMISSION_RESOURCE.TRAININGS,
  PERMISSION_RESOURCE.TRAINING_SESSIONS,
  PERMISSION_RESOURCE.ACCREDITATION_PACKS,
] as const;

/** ¿El resource pertenece a Prevención? */
export function isPrevencionResource(resource: string): boolean {
  return (PREVENCION_RESOURCES as readonly string[]).includes(resource);
}

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
      {
        resource: PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS_DIGEST,
        label: "Recibir resumen de vencimientos por correo",
        hint: "Digests diarios a admin (cursos y libreta). Configurá por rol.",
        actions: [PERMISSION_ACTION.READ],
      },
    ],
  },
  {
    module: "Prevención de riesgos",
    items: [
      {
        resource: PERMISSION_RESOURCE.CONTRACTORS,
        label: "Empresas contratistas",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.ACCREDITATIONS,
        label: "Habilitaciones / documentos",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.WORK_NOTICES,
        label: "Avisos de trabajo",
        hint: "Permiso extra · cualquier área · indica el área solicitante (User.areaId).",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.WORK_PERMITS,
        label: "Permisos de trabajo",
        hint: "receive = recibir y cerrar a bordo (capitán / colaborador).",
        actions: [...PERMISSION_ACTIONS, PERMISSION_ACTION.RECEIVE],
      },
      {
        resource: PERMISSION_RESOURCE.PERMIT_TYPES,
        label: "Tipos de permiso",
        hint: "read = elegir tipo al crear aviso · update = menú catálogo.",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.APPROVAL_FLOWS,
        label: "Flujos de aprobación",
        hint: "Plantillas EST / EST-C · menú Configuración · asignables a tipos de PT.",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.TRAININGS,
        label: "Capacitaciones (Prevención)",
        hint: "Catálogo ALT-01 / EXT-01… · independiente de Sesiones.",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.TRAINING_SESSIONS,
        label: "Sesiones capacitación",
        hint: "Dictado grupal/individual + acta · menú Prevención.",
        actions: PERMISSION_ACTIONS,
      },
      {
        resource: PERMISSION_RESOURCE.ACCREDITATION_PACKS,
        label: "Packs de habilitación",
        hint: "Pack empresa / persona · independiente de Tipos de documento.",
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
      {
        resource: PERMISSION_RESOURCE.SISTEMA_ACTIVITY_LOGS,
        label: "Bitácora",
        hint: "Registro de actividad del sistema.",
        actions: [PERMISSION_ACTION.READ],
      },
    ],
  },
];

/**
 * Acciones permitidas para un resource según el catálogo UI.
 * Sirve para seed superadmin, validación API y snapshot de /me.
 */
export function catalogActionsFor(resource: string): string[] {
  for (const mod of PERMISSION_CATALOG) {
    const item = mod.items.find((row) => row.resource === resource);
    if (item) return [...item.actions];
  }
  return [...PERMISSION_ACTIONS];
}

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
  /**
   * Preset: solicitante de avisos/PT (cualquier área vía User.areaId).
   * Tag de documento `assets` (legado de activos / área técnica).
   */
  WORK_REQUESTER: "work_requester",
  USER: "user",
  COLABORADOR: "colaborador",
  CONTRATISTA: "contratista",
  /**
   * Trabajador de faena del portal contratista:
   * ve permisos de su org y puede pedir cierre (sin HAB ni personal).
   */
  CONTRATISTA_FAENA: "contratista_faena",
} as const;

export const SYSTEM_ROLE_KEYS = Object.values(SYSTEM_ROLE_KEY);

/** Todas las acciones del catálogo para ese resource. */
function allActions(resource: string) {
  return { resource, actions: catalogActionsFor(resource) };
}

/** Solo lectura. */
function readOnly(resource: string) {
  return { resource, actions: [PERMISSION_ACTION.READ] };
}

/** CRUD sin receive (aunque el catálogo del resource lo ofrezca). */
function crudOnly(resource: string) {
  return { resource, actions: [...PERMISSION_ACTIONS] };
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
      readOnly(PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS_DIGEST),
      /** Prevención: todo lo activo de su empresa (capa módulos filtra después). */
      allActions(PERMISSION_RESOURCE.CONTRACTORS),
      allActions(PERMISSION_RESOURCE.ACCREDITATIONS),
      allActions(PERMISSION_RESOURCE.WORK_NOTICES),
      allActions(PERMISSION_RESOURCE.WORK_PERMITS),
      allActions(PERMISSION_RESOURCE.PERMIT_TYPES),
      allActions(PERMISSION_RESOURCE.APPROVAL_FLOWS),
      allActions(PERMISSION_RESOURCE.TRAININGS),
      allActions(PERMISSION_RESOURCE.TRAINING_SESSIONS),
      allActions(PERMISSION_RESOURCE.ACCREDITATION_PACKS),
      /** Empresas: ver y editar del tenant; crear/borrar sigue siendo superadmin en práctica. */
      {
        resource: PERMISSION_RESOURCE.MAESTROS_BUSINESSES,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
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
      /** RR.HH. suele necesitar el resumen diario de vigencias. */
      readOnly(PERMISSION_RESOURCE.CURSOS_NOTIFICATIONS_DIGEST),
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
      allActions(PERMISSION_RESOURCE.CONTRACTORS),
      allActions(PERMISSION_RESOURCE.ACCREDITATIONS),
      /**
       * Avisos: lectura + anular/eliminar (soft-delete).
       * Los crea el solicitante; Prevención limpia la bandeja.
       */
      {
        resource: PERMISSION_RESOURCE.WORK_NOTICES,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.DEACTIVATE],
      },
      /** PT: CRUD sin receive (eso es del capitán). */
      crudOnly(PERMISSION_RESOURCE.WORK_PERMITS),
      allActions(PERMISSION_RESOURCE.PERMIT_TYPES),
      allActions(PERMISSION_RESOURCE.TRAININGS),
      allActions(PERMISSION_RESOURCE.TRAINING_SESSIONS),
      allActions(PERMISSION_RESOURCE.ACCREDITATION_PACKS),
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
    key: SYSTEM_ROLE_KEY.WORK_REQUESTER,
    name: "Solicitante de trabajos",
    description:
      "Crea avisos de trabajo desde su área (User.areaId). Ve contratistas, habilitaciones y permisos en solo lectura.",
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
      /** Avisos: crear/editar/anular; el área solicitante sale del usuario. */
      {
        resource: PERMISSION_RESOURCE.WORK_NOTICES,
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
          PERMISSION_ACTION.DEACTIVATE,
        ],
      },
      /** Necesario para el select del modal AT2 (tipo CAL/ALT…). */
      readOnly(PERMISSION_RESOURCE.PERMIT_TYPES),
      readOnly(PERMISSION_RESOURCE.CONTRACTORS),
      readOnly(PERMISSION_RESOURCE.ACCREDITATIONS),
      readOnly(PERMISSION_RESOURCE.WORK_PERMITS),
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
      /** PT de su nave: ver + recibir/cerrar a bordo. */
      {
        resource: PERMISSION_RESOURCE.WORK_PERMITS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.RECEIVE],
      },
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.CONTRATISTA,
    name: "Contratista",
    description:
      "Proveedor externo: su organización, habilitación y permisos a completar.",
    dataScope: ROLE_DATA_SCOPE.SELF,
    permissions: [
      // Sin DASHBOARD: el panel interno expone PII de tripulantes.
      readOnly(PERMISSION_RESOURCE.CONTRACTORS),
      {
        resource: PERMISSION_RESOURCE.ACCREDITATIONS,
        // UPDATE queda para submit/subir docs; approve/validate se bloquean en service si hay organizationId.
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
        ],
      },
      {
        resource: PERMISSION_RESOURCE.WORK_PERMITS,
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
        ],
      },
    ],
  },
  {
    key: SYSTEM_ROLE_KEY.CONTRATISTA_FAENA,
    name: "Contratista faena",
    description:
      "Trabajador a bordo: ve los permisos de su empresa y pide el cierre del trabajo.",
    dataScope: ROLE_DATA_SCOPE.SELF,
    permissions: [
      {
        resource: PERMISSION_RESOURCE.WORK_PERMITS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
    ],
  },
] as const;

/**
 * Roles de portal que se pueden asignar al invitar un usuario a la org contratista.
 * `contratista` = dueño/admin; `contratista_faena` = trabajador a bordo.
 */
export const CONTRACTOR_INVITE_ROLE_KEYS = [
  SYSTEM_ROLE_KEY.CONTRATISTA,
  SYSTEM_ROLE_KEY.CONTRATISTA_FAENA,
] as const;

export type ContractorInviteRoleKey =
  (typeof CONTRACTOR_INVITE_ROLE_KEYS)[number];
