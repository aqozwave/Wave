import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  refreshBodySchema,
  refreshResponseSchema,
  registerBodySchema,
  registerResponseSchema,
} from "../modules/auth/auth.schemas.js";
import { healthResponseSchema } from "../modules/health/health.schemas.js";

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
    "Alta interna por superadmin. Crea usuario confirmed=false sin emitir tokens. Correo: stub hasta Resend.",
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
  path: "/api/v1/auth/login",
  tags: ["Auth"],
  summary: "Login",
  description:
    "Autentica con email y password. Header X-Client: web | ios. Web recibe refresh en cookie HttpOnly; iOS en el body.",
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
      description: "Sesión iniciada",
      content: {
        "application/json": {
          schema: loginResponseSchema,
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
