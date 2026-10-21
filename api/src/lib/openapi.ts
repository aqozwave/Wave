import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  loginBodySchema,
  loginResponseSchema,
} from "../modules/auth/auth.schemas.js";
import { healthResponseSchema } from "../modules/health/health.schemas.js";

const registry = new OpenAPIRegistry();

const loginHeadersSchema = z.object({
  "x-client": z.enum(["web", "ios"]),
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
  path: "/api/v1/auth/login",
  tags: ["Auth"],
  summary: "Login",
  description:
    "Autentica con email y password. Header X-Client: web | ios. Web recibe refresh en cookie HttpOnly; iOS en el body.",
  request: {
    headers: loginHeadersSchema,
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
