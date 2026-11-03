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

/**
 * IP del cliente.
 * Usa `req.ip` (Express + trust proxy). No lee X-Forwarded-For a mano:
 * sin trust proxy el header se puede spoofear y saltar el rate limit.
 */
export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Middleware: limita por IP y, si hay body.email o challengeId, también por ese valor.
 * Usar en login, verify-mfa, forgot-password, resend-*, refresh, reset, confirm.
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

/** Máximo de fallos login por par IP+email antes de bloquear ese par. */
const LOGIN_PAIR_MAX = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
/** Minutos de bloqueo del par IP+email. */
const LOGIN_PAIR_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

/** Fallos / lock en memoria por `email|ip` (no bloquea la cuenta global). */
const loginPairBuckets = new Map<
  string,
  { fails: number; lockedUntil: number | null }
>();

/** Clave estable del par email+IP. */
function loginPairKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

/**
 * Rechaza si este IP ya agotó intentos contra ese email.
 * Un atacante en otra IP no puede “cerrar” la cuenta de la víctima.
 */
export function assertLoginPairNotLocked(email: string, ip: string): void {
  const key = loginPairKey(email, ip);
  const row = loginPairBuckets.get(key);
  if (!row?.lockedUntil || row.lockedUntil <= Date.now()) {
    if (row?.lockedUntil && row.lockedUntil <= Date.now()) {
      loginPairBuckets.delete(key);
    }
    return;
  }
  const minutes = Math.ceil((row.lockedUntil - Date.now()) / 60_000);
  throw new AppError(
    403,
    "account_locked",
    `Demasiados intentos desde esta red. Reintentá en ${minutes} min`,
  );
}

/**
 * Suma un fallo de login para el par. Devuelve true si acaba de bloquearse.
 */
export function recordLoginPairFailure(email: string, ip: string): boolean {
  const key = loginPairKey(email, ip);
  const now = Date.now();
  const current = loginPairBuckets.get(key);
  if (!current || (current.lockedUntil != null && current.lockedUntil <= now)) {
    loginPairBuckets.set(key, { fails: 1, lockedUntil: null });
    return false;
  }
  if (current.lockedUntil != null && current.lockedUntil > now) {
    return true;
  }
  current.fails += 1;
  if (current.fails >= LOGIN_PAIR_MAX) {
    current.lockedUntil = now + LOGIN_PAIR_LOCK_MINUTES * 60_000;
    return true;
  }
  return false;
}

/** Limpia el contador del par tras login OK. */
export function clearLoginPair(email: string, ip: string): void {
  loginPairBuckets.delete(loginPairKey(email, ip));
}

/** Limpia todos los pares de un email (unlock admin). */
export function clearLoginPairsForEmail(email: string): void {
  const prefix = `${email.trim().toLowerCase()}|`;
  for (const key of loginPairBuckets.keys()) {
    if (key.startsWith(prefix)) {
      loginPairBuckets.delete(key);
    }
  }
}
