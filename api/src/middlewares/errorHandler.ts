import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";

/**
 * Detecta fallo de conexión a Postgres (Docker apagado, puerto 5432 caído).
 * Prisma lo lanza como PrismaClientInitializationError / P1001.
 */
function isDatabaseUnreachable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P1001"
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Can't reach database server");
}

// El cliente recibe code y message. El stack se queda en el log del proceso.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  console.error(err);

  // BD caída: mensaje accionable en Toast (no el genérico "Error interno").
  if (isDatabaseUnreachable(err)) {
    res.status(503).json({
      code: "database_unreachable",
      message:
        "No se pudo conectar a la base de datos. Abrí Docker y corré npm run db:up.",
    });
    return;
  }

  res.status(500).json({
    code: "internal_error",
    message: "Error interno",
  });
};
