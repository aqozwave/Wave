import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  confirmEmailBodySchema,
  confirmEmailResponseSchema,
  forgotPasswordBodySchema,
  forgotPasswordResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  mfaChallengeResponseSchema,
  refreshBodySchema,
  refreshResponseSchema,
  registerBodySchema,
  registerResponseSchema,
  resendConfirmationBodySchema,
  resendConfirmationResponseSchema,
  resendMfaBodySchema,
  resendMfaResponseSchema,
  resetPasswordBodySchema,
  resetPasswordResponseSchema,
  verifyMfaBodySchema,
} from "../modules/auth/auth.schemas.js";
import {
  createBusinessBodySchema,
  createBusinessResponseSchema,
  deleteBusinessResponseSchema,
  getBusinessResponseSchema,
  listBusinessesResponseSchema,
  updateBusinessBodySchema,
  updateBusinessResponseSchema,
} from "../modules/businesses/businesses.schemas.js";
import { healthResponseSchema } from "../modules/health/health.schemas.js";
import {
  createAreaBodySchema,
  createAreaResponseSchema,
  deleteAreaResponseSchema,
  getAreaResponseSchema,
  listAreasResponseSchema,
  updateAreaBodySchema,
  updateAreaResponseSchema,
} from "../modules/areas/areas.schemas.js";
import {
  createRankBodySchema,
  createRankResponseSchema,
  deleteRankResponseSchema,
  getRankResponseSchema,
  listRanksResponseSchema,
  updateRankBodySchema,
  updateRankResponseSchema,
} from "../modules/ranks/ranks.schemas.js";
import {
  createAcademicDegreeBodySchema,
  createAcademicDegreeResponseSchema,
  deleteAcademicDegreeResponseSchema,
  getAcademicDegreeResponseSchema,
  listAcademicDegreesResponseSchema,
  updateAcademicDegreeBodySchema,
  updateAcademicDegreeResponseSchema,
} from "../modules/academicDegrees/academicDegrees.schemas.js";
import {
  createCompetencyCertificateBodySchema,
  createCompetencyCertificateResponseSchema,
  deleteCompetencyCertificateResponseSchema,
  getCompetencyCertificateResponseSchema,
  listCompetencyCertificatesResponseSchema,
  officerKindSchema,
  updateCompetencyCertificateBodySchema,
  updateCompetencyCertificateResponseSchema,
} from "../modules/competencyCertificates/competencyCertificates.schemas.js";
import {
  createCourseBodySchema,
  createCourseResponseSchema,
  deleteCourseResponseSchema,
  getCourseResponseSchema,
  listCoursesResponseSchema,
  updateCourseBodySchema,
  updateCourseResponseSchema,
} from "../modules/courses/courses.schemas.js";
import {
  createMuelleBodySchema,
  createMuelleResponseSchema,
  deleteMuelleResponseSchema,
  getMuelleResponseSchema,
  listMuellesResponseSchema,
  updateMuelleBodySchema,
  updateMuelleResponseSchema,
} from "../modules/muelles/muelles.schemas.js";
import {
  createPortBodySchema,
  createPortResponseSchema,
  deletePortResponseSchema,
  getPortResponseSchema,
  listPortsResponseSchema,
  updatePortBodySchema,
  updatePortResponseSchema,
} from "../modules/ports/ports.schemas.js";
import {
  createTravesiaBodySchema,
  createTravesiaResponseSchema,
  deleteTravesiaResponseSchema,
  getTravesiaResponseSchema,
  listTravesiasResponseSchema,
  updateTravesiaBodySchema,
  updateTravesiaResponseSchema,
} from "../modules/travesias/travesias.schemas.js";
import {
  createRoleBodySchema,
  createRoleResponseSchema,
  deleteRoleResponseSchema,
  getRoleResponseSchema,
  listRolesResponseSchema,
  permissionCatalogResponseSchema,
  updateRoleBodySchema,
  updateRoleResponseSchema,
} from "../modules/roles/roles.schemas.js";
import {
  createLocationBodySchema,
  createLocationResponseSchema,
  deleteLocationResponseSchema,
  getLocationResponseSchema,
  listLocationsResponseSchema,
  updateLocationBodySchema,
  updateLocationResponseSchema,
} from "../modules/locations/locations.schemas.js";
import {
  createUserBodySchema,
  createUserResponseSchema,
  deleteUserResponseSchema,
  getUserResponseSchema,
  listUsersResponseSchema,
  unlockUserResponseSchema,
  updateUserBodySchema,
  updateUserResponseSchema,
} from "../modules/users/users.schemas.js";

const registry = new OpenAPIRegistry();

/** Header X-Client para login / refresh web vs iOS. */
const clientHeadersSchema = z.object({
  "x-client": z.enum(["web", "ios"]),
});

/** Esquema Bearer para rutas protegidas en Swagger. */
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  tags: ["Health"],
  summary: "Salud de la API",
  description: "Indica si el proceso de la API está arriba.",
  responses: {
    200: {
      description: "Proceso vivo",
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/register",
  tags: ["Auth"],
  summary: "Register (superadmin)",
  description:
    "Alta interna por superadmin. Crea usuario confirmed=false, emite EmailToken y envía correo (Resend; sin API key → stub en log).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Usuario creado",
      content: {
        "application/json": {
          schema: registerResponseSchema,
        },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No es superadmin" },
    409: { description: "Email, username o RUN duplicado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/confirm-email",
  tags: ["Auth"],
  summary: "Confirm email",
  description:
    "Activa la cuenta (confirmed=true) con el token en claro del enlace. Público.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: confirmEmailBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Cuenta confirmada",
      content: {
        "application/json": {
          schema: confirmEmailResponseSchema,
        },
      },
    },
    400: { description: "Token inválido o expirado" },
    403: { description: "Usuario desactivado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/resend-confirmation",
  tags: ["Auth"],
  summary: "Resend confirmation email",
  description:
    "Reenvía el enlace de confirmación. Respuesta siempre igual (anti-enumeración).",
  request: {
    body: {
      content: {
        "application/json": {
          schema: resendConfirmationBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Mensaje genérico",
      content: {
        "application/json": {
          schema: resendConfirmationResponseSchema,
        },
      },
    },
    400: { description: "Validación" },
    502: { description: "Fallo al enviar con Resend" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/forgot-password",
  tags: ["Auth"],
  summary: "Forgot password",
  description:
    "Solicita enlace de reset. Respuesta siempre igual (anti-enumeración).",
  request: {
    body: {
      content: {
        "application/json": {
          schema: forgotPasswordBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Mensaje genérico",
      content: {
        "application/json": {
          schema: forgotPasswordResponseSchema,
        },
      },
    },
    400: { description: "Validación" },
    502: { description: "Fallo al enviar con Resend" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/reset-password",
  tags: ["Auth"],
  summary: "Reset password",
  description:
    "Cambia la contraseña con el token del correo. Invalida sesiones previas (tokenVersion++).",
  request: {
    body: {
      content: {
        "application/json": {
          schema: resetPasswordBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Contraseña actualizada",
      content: {
        "application/json": {
          schema: resetPasswordResponseSchema,
        },
      },
    },
    400: { description: "Token inválido/expirado o validación" },
    403: { description: "Usuario desactivado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  tags: ["Auth"],
  summary: "Login",
  description:
    "Autentica con email y password. Con MFA activo responde challenge (sin tokens). Header X-Client: web | ios.",
  request: {
    headers: clientHeadersSchema,
    body: {
      content: {
        "application/json": {
          schema: loginBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sesión iniciada o challenge MFA",
      content: {
        "application/json": {
          schema: loginResponseSchema.or(mfaChallengeResponseSchema),
        },
      },
    },
    400: { description: "Validación o X-Client inválido" },
    401: { description: "Credenciales inválidas" },
    403: { description: "Cuenta bloqueada, desactivada o no confirmada" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/verify-mfa",
  tags: ["Auth"],
  summary: "Verify MFA code",
  description:
    "Completa el login con el código de 6 dígitos. Mismos tokens que login sin MFA.",
  request: {
    headers: clientHeadersSchema,
    body: {
      content: {
        "application/json": {
          schema: verifyMfaBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sesión iniciada",
      content: {
        "application/json": {
          schema: loginResponseSchema,
        },
      },
    },
    400: { description: "Código expirado o demasiados intentos" },
    401: { description: "Código incorrecto" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/resend-mfa",
  tags: ["Auth"],
  summary: "Resend MFA code",
  description: "Invalida el challenge anterior y envía un código nuevo.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: resendMfaBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Nuevo challenge",
      content: {
        "application/json": {
          schema: resendMfaResponseSchema,
        },
      },
    },
    400: { description: "Challenge expirado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh",
  description:
    "Emite nuevo access token. Web: cookie refreshToken. iOS: body.refreshToken.",
  request: {
    headers: clientHeadersSchema,
    body: {
      content: {
        "application/json": {
          schema: refreshBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tokens renovados",
      content: {
        "application/json": {
          schema: refreshResponseSchema,
        },
      },
    },
    400: { description: "X-Client inválido" },
    401: { description: "Refresh inválido o ausente" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  tags: ["Auth"],
  summary: "Usuario actual",
  description: "Devuelve el perfil del access token (Bearer).",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Perfil autenticado",
      content: {
        "application/json": {
          schema: meResponseSchema,
        },
      },
    },
    401: { description: "Sin token o token inválido" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  tags: ["Auth"],
  summary: "Logout",
  description:
    "Invalida la sesión (tokenVersion++) y borra la cookie refresh en web.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Sesión cerrada",
      content: {
        "application/json": {
          schema: logoutResponseSchema,
        },
      },
    },
    401: { description: "Sin token o token inválido" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses",
  tags: ["Businesses"],
  summary: "Listar empresas",
  description: "Superadmin: todas. Admin/user: solo la suya. Requiere Bearer.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": {
          schema: listBusinessesResponseSchema,
        },
      },
    },
    401: { description: "Sin token o token inválido" },
    403: { description: "Usuario sin empresa asignada" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses",
  tags: ["Businesses"],
  summary: "Crear empresa",
  description: "Solo superadmin. Nombre único entre no borradas.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createBusinessBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Empresa creada",
      content: {
        "application/json": {
          schema: createBusinessResponseSchema,
        },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No superadmin" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{id}",
  tags: ["Businesses"],
  summary: "Obtener empresa",
  description: "Detalle por id. Tenant: 404 si no es la suya (no superadmin).",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Empresa",
      content: {
        "application/json": { schema: getBusinessResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrada o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/businesses/{id}",
  tags: ["Businesses"],
  summary: "Actualizar empresa",
  description: "Superadmin: todos los campos. Admin: solo contacto (opción A).",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateBusinessBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Empresa actualizada",
      content: {
        "application/json": { schema: updateBusinessResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "Campo no permitido para el rol" },
    404: { description: "No encontrada" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/businesses/{id}",
  tags: ["Businesses"],
  summary: "Eliminar empresa (soft)",
  description:
    "Solo superadmin. Marca deletedAt y state=false. 409 si hay usuarios activos.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Empresa soft-deleted",
      content: {
        "application/json": { schema: deleteBusinessResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No superadmin" },
    404: { description: "No encontrada" },
    409: { description: "Tiene dependencias" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/locations",
  tags: ["Locations"],
  summary: "Listar ubicaciones",
  description:
    "Superadmin: todas (filtro opcional businessId). Admin/user: solo las de su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listLocationsResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "Usuario sin empresa asignada" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/locations",
  tags: ["Locations"],
  summary: "Crear ubicación",
  description:
    "Admin o superadmin. Admin: businessId = su empresa. Superadmin: businessId obligatorio. Nombre único por empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createLocationBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Ubicación creada",
      content: {
        "application/json": { schema: createLocationResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/locations/{id}",
  tags: ["Locations"],
  summary: "Obtener ubicación",
  description: "Detalle por id. Tenant: 404 si no es de su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Ubicación",
      content: {
        "application/json": { schema: getLocationResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrada o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/locations/{id}",
  tags: ["Locations"],
  summary: "Actualizar ubicación",
  description:
    "Admin o superadmin. Admin no puede mover businessId a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateLocationBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Ubicación actualizada",
      content: {
        "application/json": { schema: updateLocationResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrada" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/locations/{id}",
  tags: ["Locations"],
  summary: "Eliminar ubicación (soft)",
  description:
    "Admin o superadmin. Marca deletedAt y state=false. 409 si hay usuarios activos.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Ubicación soft-deleted",
      content: {
        "application/json": { schema: deleteLocationResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrada" },
    409: { description: "Tiene dependencias" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/areas",
  tags: ["Areas"],
  summary: "Listar áreas",
  description:
    "Superadmin: todas (filtros businessId / locationId). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
      locationId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listAreasResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/areas",
  tags: ["Areas"],
  summary: "Crear área",
  description:
    "Admin o superadmin. locationId obligatorio. businessId se toma de la location (si se envía, debe coincidir).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createAreaBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Área creada",
      content: {
        "application/json": { schema: createAreaResponseSchema },
      },
    },
    400: { description: "Validación o location/empresa incoherentes" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en el lugar" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/areas/{id}",
  tags: ["Areas"],
  summary: "Obtener área",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Área",
      content: {
        "application/json": { schema: getAreaResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrada o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/areas/{id}",
  tags: ["Areas"],
  summary: "Actualizar área",
  description:
    "Si cambia locationId, se recalcula businessId. businessId enviado debe coincidir con la location.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateAreaBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Área actualizada",
      content: {
        "application/json": { schema: updateAreaResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrada" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/areas/{id}",
  tags: ["Areas"],
  summary: "Eliminar área (soft)",
  description: "409 si hay usuarios activos con ese areaId.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Área soft-deleted",
      content: {
        "application/json": { schema: deleteAreaResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrada" },
    409: { description: "Tiene dependencias" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/ranks",
  tags: ["Ranks"],
  summary: "Listar rangos / cargos",
  description:
    "Superadmin: todos (filtro businessId opcional). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listRanksResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/ranks",
  tags: ["Ranks"],
  summary: "Crear rango",
  description:
    "Admin o superadmin. businessId obligatorio para superadmin; admin usa el suyo.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createRankBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Rango creado",
      content: {
        "application/json": { schema: createRankResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/ranks/{id}",
  tags: ["Ranks"],
  summary: "Obtener rango",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Rango",
      content: {
        "application/json": { schema: getRankResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/ranks/{id}",
  tags: ["Ranks"],
  summary: "Actualizar rango",
  description: "Admin no puede mover el rango a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateRankBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Rango actualizado",
      content: {
        "application/json": { schema: updateRankResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/ranks/{id}",
  tags: ["Ranks"],
  summary: "Eliminar rango (soft)",
  description:
    "Soft delete. En S7 se rechazará si hay tripulantes activos con ese rankId.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Rango soft-deleted",
      content: {
        "application/json": { schema: deleteRankResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/academic-degrees",
  tags: ["AcademicDegrees"],
  summary: "Listar títulos",
  description:
    "Superadmin: todos (filtro businessId opcional). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listAcademicDegreesResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/academic-degrees",
  tags: ["AcademicDegrees"],
  summary: "Crear título",
  description:
    "Admin o superadmin. businessId obligatorio para superadmin; admin usa el suyo.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createAcademicDegreeBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Título creado",
      content: {
        "application/json": { schema: createAcademicDegreeResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/academic-degrees/{id}",
  tags: ["AcademicDegrees"],
  summary: "Obtener título",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Título",
      content: {
        "application/json": { schema: getAcademicDegreeResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/academic-degrees/{id}",
  tags: ["AcademicDegrees"],
  summary: "Actualizar título",
  description: "Admin no puede mover el título a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateAcademicDegreeBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Título actualizado",
      content: {
        "application/json": { schema: updateAcademicDegreeResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/academic-degrees/{id}",
  tags: ["AcademicDegrees"],
  summary: "Eliminar título (soft)",
  description:
    "Soft delete. En S7 se rechazará si hay tripulantes activos con ese academicDegreeId.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Título soft-deleted",
      content: {
        "application/json": { schema: deleteAcademicDegreeResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/competency-certificates",
  tags: ["CompetencyCertificates"],
  summary: "Listar certificados de competencia",
  description:
    "Superadmin: todos (filtros businessId / officerKind). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
      officerKind: officerKindSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": {
          schema: listCompetencyCertificatesResponseSchema,
        },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/competency-certificates",
  tags: ["CompetencyCertificates"],
  summary: "Crear certificado",
  description:
    "Admin o superadmin. businessId obligatorio para superadmin. officerKind opcional (captain | first_pilot).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createCompetencyCertificateBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Certificado creado",
      content: {
        "application/json": {
          schema: createCompetencyCertificateResponseSchema,
        },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/competency-certificates/{id}",
  tags: ["CompetencyCertificates"],
  summary: "Obtener certificado",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Certificado",
      content: {
        "application/json": {
          schema: getCompetencyCertificateResponseSchema,
        },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/competency-certificates/{id}",
  tags: ["CompetencyCertificates"],
  summary: "Actualizar certificado",
  description: "Admin no puede mover el certificado a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateCompetencyCertificateBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Certificado actualizado",
      content: {
        "application/json": {
          schema: updateCompetencyCertificateResponseSchema,
        },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/competency-certificates/{id}",
  tags: ["CompetencyCertificates"],
  summary: "Eliminar certificado (soft)",
  description:
    "Soft delete. En S7 se rechazará si hay tripulantes activos con ese id.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Certificado soft-deleted",
      content: {
        "application/json": {
          schema: deleteCompetencyCertificateResponseSchema,
        },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/courses",
  tags: ["Courses"],
  summary: "Listar cursos",
  description:
    "Superadmin: todos (filtro businessId opcional). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listCoursesResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/courses",
  tags: ["Courses"],
  summary: "Crear curso",
  description:
    "Admin o superadmin. Requiere name y whereTaught. businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createCourseBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Curso creado",
      content: {
        "application/json": { schema: createCourseResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre + lugar duplicados en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/courses/{id}",
  tags: ["Courses"],
  summary: "Obtener curso",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Curso",
      content: {
        "application/json": { schema: getCourseResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/courses/{id}",
  tags: ["Courses"],
  summary: "Actualizar curso",
  description: "Admin no puede mover el curso a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateCourseBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Curso actualizado",
      content: {
        "application/json": { schema: updateCourseResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre + lugar duplicados" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/courses/{id}",
  tags: ["Courses"],
  summary: "Eliminar curso (soft)",
  description:
    "Soft delete. En S8 se rechazará si hay asignaciones activas a tripulantes.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Curso soft-deleted",
      content: {
        "application/json": { schema: deleteCourseResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/ports",
  tags: ["Ports"],
  summary: "Listar puertos",
  description:
    "Superadmin: todos (filtro businessId). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listPortsResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/ports",
  tags: ["Ports"],
  summary: "Crear puerto",
  description:
    "Admin o superadmin. Requiere name. businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createPortBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Puerto creado",
      content: {
        "application/json": { schema: createPortResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/ports/{id}",
  tags: ["Ports"],
  summary: "Obtener puerto",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Puerto",
      content: {
        "application/json": { schema: getPortResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/ports/{id}",
  tags: ["Ports"],
  summary: "Actualizar puerto",
  description: "Admin no puede mover el puerto a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updatePortBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Puerto actualizado",
      content: {
        "application/json": { schema: updatePortResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado en empresa" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/ports/{id}",
  tags: ["Ports"],
  summary: "Eliminar puerto (soft)",
  description: "Soft delete. Rechaza si hay muelles activos en el puerto.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Puerto soft-deleted",
      content: {
        "application/json": { schema: deletePortResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
    409: { description: "Puerto en uso por muelles" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/muelles",
  tags: ["Muelles"],
  summary: "Listar muelles",
  description:
    "Superadmin: todos (filtros businessId / portId). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
      portId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listMuellesResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/muelles",
  tags: ["Muelles"],
  summary: "Crear muelle",
  description:
    "Admin o superadmin. Requiere name y portId. businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createMuelleBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Muelle creado",
      content: {
        "application/json": { schema: createMuelleResponseSchema },
      },
    },
    400: { description: "Validación, empresa o puerto inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en puerto y empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/muelles/{id}",
  tags: ["Muelles"],
  summary: "Obtener muelle",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Muelle",
      content: {
        "application/json": { schema: getMuelleResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/muelles/{id}",
  tags: ["Muelles"],
  summary: "Actualizar muelle",
  description: "Admin no puede mover el muelle a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateMuelleBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Muelle actualizado",
      content: {
        "application/json": { schema: updateMuelleResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado en puerto y empresa" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/muelles/{id}",
  tags: ["Muelles"],
  summary: "Eliminar muelle (soft)",
  description:
    "Soft delete. En S7 se rechazará si hay asignaciones activas a tripulantes.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Muelle soft-deleted",
      content: {
        "application/json": { schema: deleteMuelleResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/travesias",
  tags: ["Travesias"],
  summary: "Listar travesías",
  description:
    "Superadmin: todas (filtro businessId). Admin/user: solo su empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      businessId: z.uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listTravesiasResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/travesias",
  tags: ["Travesias"],
  summary: "Crear travesía",
  description:
    "Admin o superadmin. Requiere name y requiredPassages (10 o 4). businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createTravesiaBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Travesía creada",
      content: {
        "application/json": { schema: createTravesiaResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    409: { description: "Nombre duplicado en empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/travesias/{id}",
  tags: ["Travesias"],
  summary: "Obtener travesía",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Travesía",
      content: {
        "application/json": { schema: getTravesiaResponseSchema },
      },
    },
    401: { description: "Sin token" },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/travesias/{id}",
  tags: ["Travesias"],
  summary: "Actualizar travesía",
  description: "Admin no puede mover la travesía a otra empresa.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateTravesiaBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Travesía actualizada",
      content: {
        "application/json": { schema: updateTravesiaResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
    403: { description: "No permitido" },
    404: { description: "No encontrado" },
    409: { description: "Nombre duplicado en empresa" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/travesias/{id}",
  tags: ["Travesias"],
  summary: "Eliminar travesía (soft)",
  description:
    "Soft delete. En S7 se rechazará si hay asignaciones activas a tripulantes.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Travesía soft-deleted",
      content: {
        "application/json": { schema: deleteTravesiaResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/roles",
  tags: ["Roles"],
  summary: "Listar roles",
  description: "Admin o superadmin. includeInactive=true para inactivos.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      includeInactive: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado",
      content: {
        "application/json": { schema: listRolesResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/roles/catalog",
  tags: ["Roles"],
  summary: "Catálogo de permisos",
  description: "Solo superadmin. Matriz resource/actions para la UI.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Catálogo",
      content: {
        "application/json": { schema: permissionCatalogResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "No superadmin" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/roles",
  tags: ["Roles"],
  summary: "Crear rol",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createRoleBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Rol creado",
      content: {
        "application/json": { schema: createRoleResponseSchema },
      },
    },
    400: { description: "Validación" },
    403: { description: "No superadmin" },
    409: { description: "Duplicado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/roles/{id}",
  tags: ["Roles"],
  summary: "Obtener rol",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Rol",
      content: {
        "application/json": { schema: getRoleResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/roles/{id}",
  tags: ["Roles"],
  summary: "Actualizar rol",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateRoleBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Rol actualizado",
      content: {
        "application/json": { schema: updateRoleResponseSchema },
      },
    },
    400: { description: "Validación" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/roles/{id}",
  tags: ["Roles"],
  summary: "Eliminar rol (soft)",
  description: "No elimina roles de sistema ni roles con usuarios.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteRoleResponseSchema },
      },
    },
    400: { description: "Rol de sistema" },
    409: { description: "En uso" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/users",
  tags: ["Users"],
  summary: "Listar usuarios",
  description:
    "Requiere maestros.users:read. Admin solo ve su empresa; superadmin todas.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      search: z.string().optional(),
      businessId: z.uuid().optional(),
      includeInactive: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listUsersResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "Sin permiso" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/users",
  tags: ["Users"],
  summary: "Crear usuario",
  description:
    "Requiere maestros.users:create. Envía correo de confirmación (confirmed=false).",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createUserBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Usuario creado",
      content: {
        "application/json": { schema: createUserResponseSchema },
      },
    },
    400: { description: "Validación" },
    403: { description: "Sin permiso" },
    409: { description: "Duplicado email/username/run" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/users/{id}",
  tags: ["Users"],
  summary: "Obtener usuario",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Usuario",
      content: {
        "application/json": { schema: getUserResponseSchema },
      },
    },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/users/{id}",
  tags: ["Users"],
  summary: "Actualizar usuario",
  description:
    "Requiere maestros.users:update. El admin puede cambiar el email directo.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateUserBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Usuario actualizado",
      content: {
        "application/json": { schema: updateUserResponseSchema },
      },
    },
    400: { description: "Validación" },
    403: { description: "Sin permiso" },
    404: { description: "No encontrado" },
    409: { description: "Duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/users/{id}",
  tags: ["Users"],
  summary: "Eliminar usuario (soft)",
  description: "Requiere maestros.users:deactivate. No permite borrarse a sí mismo.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteUserResponseSchema },
      },
    },
    400: { description: "Auto-borrado" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/users/{id}/unlock",
  tags: ["Users"],
  summary: "Desbloquear usuario",
  description: "Limpia loginAttempts y lockUntil.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Desbloqueado",
      content: {
        "application/json": { schema: unlockUserResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

/** Documento OpenAPI 3 para Swagger UI y clientes tipados. */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Wave API",
      version: "0.1.0",
      description: "Portal Nachipa Wellboats — API",
    },
    servers: [{ url: "http://localhost:3000", description: "local" }],
  });
}
