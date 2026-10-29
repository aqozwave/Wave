import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  changeMyPasswordBodySchema,
  changeMyPasswordResponseSchema,
  confirmEmailBodySchema,
  confirmEmailResponseSchema,
  forgotPasswordBodySchema,
  forgotPasswordResponseSchema,
  deleteMyPhotoResponseSchema,
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
  updateMeBodySchema,
  updateMeResponseSchema,
  uploadMyPhotoBodySchema,
  uploadMyPhotoResponseSchema,
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
  deleteUserPhotoResponseSchema,
  deleteUserResponseSchema,
  getUserResponseSchema,
  listUsersResponseSchema,
  unlockUserResponseSchema,
  updateUserBodySchema,
  updateUserResponseSchema,
  uploadUserPhotoBodySchema,
  uploadUserPhotoResponseSchema,
} from "../modules/users/users.schemas.js";
import {
  createCrewMemberBodySchema,
  createCrewMemberResponseSchema,
  deleteCrewMemberResponseSchema,
  getCrewMemberResponseSchema,
  listCrewMembersResponseSchema,
  updateCrewMemberBodySchema,
  updateCrewMemberResponseSchema,
} from "../modules/crewMembers/crewMembers.schemas.js";
import {
  createCrewMemberDocumentBodySchema,
  createCrewMemberDocumentResponseSchema,
  deleteCrewMemberDocumentResponseSchema,
  listCrewMemberDocumentsResponseSchema,
} from "../modules/crewMemberDocuments/crewMemberDocuments.schemas.js";
import {
  createCrewMemberMuelleBodySchema,
  createCrewMemberMuelleResponseSchema,
  createCrewMemberTravesiaBodySchema,
  createCrewMemberTravesiaResponseSchema,
  deleteCrewMemberMuelleResponseSchema,
  deleteCrewMemberTravesiaResponseSchema,
  listCrewMemberMuellesResponseSchema,
  listCrewMemberTravesiasResponseSchema,
} from "../modules/crewMemberAssignments/crewMemberAssignments.schemas.js";
import {
  createDocumentTypeBodySchema,
  createDocumentTypeResponseSchema,
  deleteDocumentTypeResponseSchema,
  documentSubtypeSchema,
  getDocumentTypeResponseSchema,
  listDocumentTypesResponseSchema,
  updateDocumentTypeBodySchema,
  updateDocumentTypeResponseSchema,
} from "../modules/documentTypes/documentTypes.schemas.js";

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
  method: "patch",
  path: "/api/v1/auth/me",
  tags: ["Auth"],
  summary: "Actualizar mi perfil",
  description: "Nombre, apellido o correo del usuario autenticado.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: updateMeBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Perfil actualizado",
      content: {
        "application/json": { schema: updateMeResponseSchema },
      },
    },
    401: { description: "Sin token" },
    409: { description: "Email duplicado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/me/photo",
  tags: ["Auth"],
  summary: "Subir mi foto de perfil",
  description:
    "JSON + base64. Magic bytes deben coincidir con mimeType (JPEG/PNG/WebP), máx 2 MB. Servido en /uploads con X-Content-Type-Options: nosniff.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: uploadMyPhotoBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Foto actualizada",
      content: {
        "application/json": { schema: uploadMyPhotoResponseSchema },
      },
    },
    400: { description: "Validación" },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/auth/me/photo",
  tags: ["Auth"],
  summary: "Quitar mi foto de perfil",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Foto eliminada",
      content: {
        "application/json": { schema: deleteMyPhotoResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/me/password",
  tags: ["Auth"],
  summary: "Cambiar mi contraseña",
  description:
    "Requiere contraseña actual. Sube tokenVersion (cierra otras sesiones) y reemite tokens. Header X-Client: web | ios.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: changeMyPasswordBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Contraseña actualizada; sesión renovada",
      content: {
        "application/json": { schema: changeMyPasswordResponseSchema },
      },
    },
    400: { description: "Validación o misma contraseña" },
    401: { description: "Sin token o contraseña actual incorrecta" },
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
    "Admin/superadmin + permiso maestros.certificates. businessId obligatorio para superadmin. requiresMuelleTravesia opcional.",
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
  path: "/api/v1/document-types",
  tags: ["DocumentTypes"],
  summary: "Listar tipos de documento",
  description:
    "Maestro por empresa (códigos HR). Superadmin: filtro businessId. Admin/user: su empresa. Permiso maestros.document_types read.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().default(1).optional(),
      limit: z.coerce.number().int().positive().max(200).default(100).optional(),
      businessId: z.uuid().optional(),
      subtype: documentSubtypeSchema.optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listDocumentTypesResponseSchema },
      },
    },
    401: { description: "Sin token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/document-types",
  tags: ["DocumentTypes"],
  summary: "Crear tipo de documento",
  description:
    "Admin/superadmin + permiso maestros.document_types create. businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createDocumentTypeBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Creado",
      content: {
        "application/json": { schema: createDocumentTypeResponseSchema },
      },
    },
    400: { description: "Validación o empresa inexistente" },
    401: { description: "Sin token" },
    403: { description: "No admin/superadmin o sin permiso" },
    409: { description: "Código duplicado en la empresa" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/document-types/{id}",
  tags: ["DocumentTypes"],
  summary: "Obtener tipo de documento",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Tipo",
      content: {
        "application/json": { schema: getDocumentTypeResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/document-types/{id}",
  tags: ["DocumentTypes"],
  summary: "Actualizar tipo de documento",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateDocumentTypeBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Actualizado",
      content: {
        "application/json": { schema: updateDocumentTypeResponseSchema },
      },
    },
    404: { description: "No encontrado" },
    409: { description: "Código duplicado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/document-types/{id}",
  tags: ["DocumentTypes"],
  summary: "Eliminar tipo de documento (soft)",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteDocumentTypeResponseSchema },
      },
    },
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
    "Requiere maestros.users:create. Envía un enlace para elegir contraseña. Al usarlo la cuenta queda confirmada.",
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

registry.registerPath({
  method: "post",
  path: "/api/v1/users/{id}/photo",
  tags: ["Users"],
  summary: "Subir foto de perfil",
  description:
    "JSON + base64. Magic bytes deben coincidir con mimeType (JPEG/PNG/WebP), máx 2 MB. /uploads con nosniff.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: uploadUserPhotoBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Foto actualizada",
      content: {
        "application/json": { schema: uploadUserPhotoResponseSchema },
      },
    },
    400: { description: "Validación / mime / tamaño" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/users/{id}/photo",
  tags: ["Users"],
  summary: "Quitar foto de perfil",
  description: "Deja photoProfile en null y borra el archivo del disco.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Foto eliminada",
      content: {
        "application/json": { schema: deleteUserPhotoResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members",
  tags: ["CrewMembers"],
  summary: "Listar tripulantes",
  description:
    "Requiere embarcados:read. Admin solo su empresa; superadmin todas.",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      search: z.string().optional(),
      businessId: z.uuid().optional(),
      locationId: z.uuid().optional(),
      includeInactive: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Listado paginado",
      content: {
        "application/json": { schema: listCrewMembersResponseSchema },
      },
    },
    401: { description: "Sin token" },
    403: { description: "Sin permiso" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/crew-members",
  tags: ["CrewMembers"],
  summary: "Crear tripulante",
  description:
    "Requiere embarcados:create. businessId obligatorio para superadmin.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createCrewMemberBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Creado",
      content: {
        "application/json": { schema: createCrewMemberResponseSchema },
      },
    },
    400: { description: "Validación / FK" },
    403: { description: "Sin permiso" },
    409: { description: "RUN o email duplicado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members/{id}",
  tags: ["CrewMembers"],
  summary: "Obtener tripulante",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Ficha",
      content: {
        "application/json": { schema: getCrewMemberResponseSchema },
      },
    },
    404: { description: "No encontrado o sin acceso" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/crew-members/{id}",
  tags: ["CrewMembers"],
  summary: "Actualizar tripulante",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: updateCrewMemberBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Actualizado",
      content: {
        "application/json": { schema: updateCrewMemberResponseSchema },
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
  path: "/api/v1/crew-members/{id}",
  tags: ["CrewMembers"],
  summary: "Eliminar tripulante (soft)",
  description: "Requiere embarcados:deactivate. Desvincula userId.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteCrewMemberResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members/{id}/documents",
  tags: ["CrewMemberDocuments"],
  summary: "Listar documentos del tripulante",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Listado",
      content: {
        "application/json": { schema: listCrewMemberDocumentsResponseSchema },
      },
    },
    404: { description: "Tripulante no encontrado" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/crew-members/{id}/documents",
  tags: ["CrewMemberDocuments"],
  summary: "Subir documento (base64 JSON)",
  description:
    "documentTypeId del maestro. Magic bytes deben coincidir con mimeType (PDF/JPEG/PNG/WebP), máx 10 MB. Descarga con X-Content-Type-Options: nosniff. sourceModule opcional.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: createCrewMemberDocumentBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Creado",
      content: {
        "application/json": { schema: createCrewMemberDocumentResponseSchema },
      },
    },
    400: { description: "Validación / mime / tamaño" },
    404: { description: "Tripulante no encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members/{id}/documents/{documentId}/download",
  tags: ["CrewMemberDocuments"],
  summary: "Descargar documento",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid(), documentId: z.uuid() }),
  },
  responses: {
    200: { description: "Stream del archivo" },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/crew-members/{id}/documents/{documentId}",
  tags: ["CrewMemberDocuments"],
  summary: "Eliminar documento (soft + disco)",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid(), documentId: z.uuid() }),
  },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteCrewMemberDocumentResponseSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members/{id}/muelles",
  tags: ["CrewMemberAssignments"],
  summary: "Listar muelles del tripulante",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Listado",
      content: {
        "application/json": { schema: listCrewMemberMuellesResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/crew-members/{id}/muelles",
  tags: ["CrewMemberAssignments"],
  summary: "Asignar muelle",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: createCrewMemberMuelleBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Asignado",
      content: {
        "application/json": { schema: createCrewMemberMuelleResponseSchema },
      },
    },
    409: { description: "Ya asignado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/crew-members/{id}/muelles/{assignmentId}",
  tags: ["CrewMemberAssignments"],
  summary: "Quitar asignación de muelle",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid(), assignmentId: z.uuid() }),
  },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteCrewMemberMuelleResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/crew-members/{id}/travesias",
  tags: ["CrewMemberAssignments"],
  summary: "Listar travesías del tripulante",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: "Listado",
      content: {
        "application/json": { schema: listCrewMemberTravesiasResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/crew-members/{id}/travesias",
  tags: ["CrewMemberAssignments"],
  summary: "Asignar travesía",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        "application/json": { schema: createCrewMemberTravesiaBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Asignado",
      content: {
        "application/json": { schema: createCrewMemberTravesiaResponseSchema },
      },
    },
    409: { description: "Ya asignado" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/crew-members/{id}/travesias/{assignmentId}",
  tags: ["CrewMemberAssignments"],
  summary: "Quitar asignación de travesía",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.uuid(), assignmentId: z.uuid() }),
  },
  responses: {
    200: {
      description: "Soft-deleted",
      content: {
        "application/json": { schema: deleteCrewMemberTravesiaResponseSchema },
      },
    },
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
