import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";

/** Ventana deslizante en ms (1 minuto). */
const WINDOW_MS = 60_000;

/** Máximo de intentos por clave dentro de la ventana. */
const MAX_HITS = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20);

/** Contadores en memoria del proceso (se reinician al reiniciar la API). */
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Registra un hit; lanza 429 si la clave superó el máximo.
 * Clave = prefijo + identificador (IP, email, challengeId…).
 */
export function hitRateLimit(key: string): void {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count > MAX_HITS) {
    throw new AppError(
      429,
      "rate_limited",
      "Demasiados intentos. Esperá un minuto e intentá de nuevo.",
    );
  }
}

/** IP del cliente (proxy Vite / Express trust proxy). */
export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Middleware: limita por IP y, si hay body.email o challengeId, también por ese valor.
 * Usar en login, verify-mfa, forgot-password, resend-*.
 */
export function authRateLimit(bucket: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const ip = clientIp(req);
      hitRateLimit(`auth:${bucket}:ip:${ip}`);

      const body = req.body as Record<string, unknown> | undefined;
      const email =
        typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email) {
        hitRateLimit(`auth:${bucket}:email:${email}`);
      }

      const challengeId =
        typeof body?.challengeId === "string" ? body.challengeId.trim() : "";
      if (challengeId) {
        hitRateLimit(`auth:${bucket}:challenge:${challengeId}`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
