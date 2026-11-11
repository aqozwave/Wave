import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";
import { verifyAccessToken } from "./tokens.js";

/** Ventana fija en ms (1 minuto) para auth y para el tope global de /api. */
const WINDOW_MS = 60_000;

/** Máximo de intentos de auth por clave dentro de la ventana. */
const MAX_HITS = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20);

/**
 * Entero ≥ 1 desde env. Si falta o no es válido, usa el default.
 * Un NaN desactivaría el tope (`count > NaN` nunca es true).
 */
function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

/**
 * Requests /api por usuario con access token válido, en la ventana.
 * 180/min alcanza para varias pantallas abiertas y corta un script.
 */
const API_USER_MAX = readPositiveInt(process.env.API_RATE_LIMIT_USER_MAX, 180);

/**
 * Requests /api por IP cuando no hay access token válido, en la ventana.
 * Cubre health, login y docs. El login sigue con su tope más bajo (20).
 */
const API_IP_MAX = readPositiveInt(process.env.API_RATE_LIMIT_IP_MAX, 60);

/** 429 de las rutas de auth (login, MFA, refresh, reset). */
const AUTH_RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Esperá un minuto e intentá de nuevo.";

/** 429 del tope global de /api. */
const API_RATE_LIMIT_MESSAGE =
  "Demasiadas solicitudes. Esperá un minuto e intentá de nuevo.";

/** Cada cuánto barrer entradas vencidas de los Maps. */
const CLEANUP_INTERVAL_MS = 60_000;

/** Contadores en memoria del proceso (se reinician al reiniciar la API). */
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Registra un hit; lanza 429 si la clave superó el máximo.
 * Clave = prefijo + identificador (IP, email, user id, challengeId…).
 * `maxHits` permite topes distintos (auth vs /api) en el mismo Map.
 */
export function hitRateLimit(
  key: string,
  maxHits = MAX_HITS,
  message = AUTH_RATE_LIMIT_MESSAGE,
): void {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count > maxHits) {
    throw new AppError(429, "rate_limited", message);
  }
}

/**
 * `sub` del access token si la firma es válida.
 * No consulta la BD: el tope tiene que frenar antes de abrir una conexión.
 * Token ausente, vencido o mal firmado → null (la clave pasa a ser la IP).
 */
function readBearerSubject(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const sub = verifyAccessToken(token).sub;
    if (typeof sub !== "string" || sub.length === 0) return null;
    return sub;
  } catch {
    return null;
  }
}

/**
 * Tope global de /api para no saturar el proceso ni Postgres.
 * Con Bearer válido cuenta por usuario (varias personas detrás de un NAT no comparten cupo).
 * Sin token válido cuenta por IP. Va antes de parsear el body.
 */
export function apiRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const subject = readBearerSubject(req);
    if (subject) {
      hitRateLimit(`api:user:${subject}`, API_USER_MAX, API_RATE_LIMIT_MESSAGE);
    } else {
      hitRateLimit(`api:ip:${clientIp(req)}`, API_IP_MAX, API_RATE_LIMIT_MESSAGE);
    }
    next();
  } catch (err) {
    next(err);
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

/**
 * Mensaje idéntico al de credenciales inválidas (anti-enumeración del lock).
 * El status también es 401, no 403.
 */
export const LOGIN_PAIR_LOCK_MESSAGE = "Credenciales inválidas";

/** Fallos / lock en memoria por `email|ip` (no bloquea la cuenta global). */
const loginPairBuckets = new Map<
  string,
  { fails: number; lockedUntil: number | null; touchAt: number }
>();

/** Clave estable del par email+IP. */
function loginPairKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

/**
 * Rechaza si este IP ya agotó intentos contra ese email.
 * Mismo 401 + mensaje que clave mala (no filtrar “locked” vs “bad password”).
 */
export function assertLoginPairNotLocked(email: string, ip: string): void {
  const key = loginPairKey(email, ip);
  const row = loginPairBuckets.get(key);
  const now = Date.now();
  if (!row?.lockedUntil || row.lockedUntil <= now) {
    if (row?.lockedUntil && row.lockedUntil <= now) {
      loginPairBuckets.delete(key);
    }
    return;
  }
  throw new AppError(401, "invalid_credentials", LOGIN_PAIR_LOCK_MESSAGE);
}

/**
 * Suma un fallo de login para el par. Devuelve true si acaba de bloquearse.
 */
export function recordLoginPairFailure(email: string, ip: string): boolean {
  const key = loginPairKey(email, ip);
  const now = Date.now();
  const current = loginPairBuckets.get(key);
  if (!current || (current.lockedUntil != null && current.lockedUntil <= now)) {
    loginPairBuckets.set(key, { fails: 1, lockedUntil: null, touchAt: now });
    return false;
  }
  if (current.lockedUntil != null && current.lockedUntil > now) {
    return true;
  }
  current.fails += 1;
  current.touchAt = now;
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

/**
 * Borra entradas vencidas de rate-limit y de pares login.
 * Evita que Maps crezcan sin cota ante emails/IPs aleatorios.
 */
export function sweepRateLimitMemory(now = Date.now()): void {
  for (const [key, row] of buckets) {
    if (row.resetAt <= now) {
      buckets.delete(key);
    }
  }
  const failTtlMs = LOGIN_PAIR_LOCK_MINUTES * 60_000;
  for (const [key, row] of loginPairBuckets) {
    if (row.lockedUntil != null) {
      if (row.lockedUntil <= now) {
        loginPairBuckets.delete(key);
      }
      continue;
    }
    // Fallos sin lock: expiran tras la misma ventana de lock.
    if (row.touchAt + failTtlMs <= now) {
      loginPairBuckets.delete(key);
    }
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/** Arranca el barrido periódico (idempotente). Llamar desde createApp. */
export function startRateLimitCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    sweepRateLimitMemory();
  }, CLEANUP_INTERVAL_MS);
  // No mantener el proceso vivo solo por este timer.
  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }
}
