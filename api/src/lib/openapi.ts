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
  createLocationBodySchema,
  createLocationResponseSchema,
  listLocationsResponseSchema,
} from "../modules/locations/locations.schemas.js";

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
  description:
    "Superadmin: todas. Admin/user: solo la suya. Requiere Bearer.",
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
  description:
    "Superadmin: todos los campos. Admin: solo contacto (opción A).",
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
