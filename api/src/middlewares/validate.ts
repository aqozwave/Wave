import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../lib/errors.js";

type RequestSchema = ZodType<{
  body?: unknown;
  query?: unknown;
  params?: unknown;
}>;

// Valida body/query/params y reemplaza lo parseado (tipos y defaults de Zod).
export function validate(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!parsed.success) {
      // Mensaje legible: «RUN inválido» en vez del genérico «Datos inválidos».
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path
          .filter((p) => p !== "body" && p !== "query" && p !== "params")
          .join("."),
        message: issue.message,
      }));
      const summary =
        [...new Set(issues.map((i) => i.message))].join(" · ") ||
        "Datos inválidos";
      next(
        new AppError(400, "validation_error", summary, {
          issues,
          ...parsed.error.flatten(),
        }),
      );
      return;
    }

    if (parsed.data.body !== undefined) {
      req.body = parsed.data.body;
    }
    // Express 5: query/params son getters; la asignación simple no pisa el valor.
    if (parsed.data.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: parsed.data.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (parsed.data.params !== undefined) {
      Object.defineProperty(req, "params", {
        value: parsed.data.params,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}
