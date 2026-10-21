import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors.js";

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

  res.status(500).json({
    code: "internal_error",
    message: "Error interno",
  });
};
