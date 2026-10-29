import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

/** Claims del access JWT: identidad + versión para invalidar sesiones. */
export type AccessPayload = {
  sub: string;
  username: string;
  internalRol: string;
  businessId: string | null;
  /** tokenVersion del User; si no coincide, el token ya no vale. */
  v: number;
};

/** Claims del refresh JWT; `kind` evita usarlo como access. `jti` liga a la fila BD. */
export type RefreshPayload = {
  sub: string;
  v: number;
  kind: "refresh";
  /** Id de la fila RefreshToken (permite rotar/revocar ese JWT). */
  jti: string;
};

/** Lee un secreto obligatorio del entorno (falla temprano si falta). */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno ${name}`);
  }
  return value;
}

/** Default de vida del refresh (ms) si JWT_REFRESH_EXPIRES_IN no parsea. */
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parsea "15m" / "7d" / "1h" a milisegundos.
 * Solo unidades usadas en Wave; si falla, usa el fallback.
 */
export function parseDurationToMs(
  raw: string | undefined,
  fallbackMs: number,
): number {
  if (!raw) return fallbackMs;
  const match = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60_000;
  if (unit === "h") return n * 3_600_000;
  return n * 86_400_000;
}

/** Vida del refresh en ms (cookie Max-Age + expiresAt en BD). */
export function refreshTtlMs(): number {
  return parseDurationToMs(
    process.env.JWT_REFRESH_EXPIRES_IN,
    DEFAULT_REFRESH_MS,
  );
}

/** SHA-256 hex del JWT de refresh (lo que se guarda en BD). */
export function hashRefreshToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Firma el access token de vida corta (default 15m). */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, requireEnv("JWT_SECRET"), {
    // Default corto: reduce ventana si el token se filtra.
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  } as jwt.SignOptions);
}

/**
 * Firma el refresh (default 7d) con jti propio.
 * El caller persiste hash(jti+token) / hash(token) en RefreshToken.
 */
export function signRefreshToken(
  payload: Omit<RefreshPayload, "kind" | "jti"> & { jti?: string },
): { token: string; jti: string; expiresAt: Date } {
  const jti = payload.jti ?? randomUUID();
  const ttlMs = refreshTtlMs();
  const token = jwt.sign(
    { sub: payload.sub, v: payload.v, kind: "refresh", jti },
    requireEnv("JWT_REFRESH_SECRET"),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    } as jwt.SignOptions,
  );
  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

/** Verifica y tipa el access token; lanza si es inválido o expirado. */
export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, requireEnv("JWT_SECRET"));
  if (typeof decoded !== "object" || decoded === null || !("sub" in decoded)) {
    throw new jwt.JsonWebTokenError("Access token inválido");
  }
  return decoded as AccessPayload;
}

/**
 * Verifica el refresh token (secreto distinto + kind === "refresh" + jti).
 * Así un access JWT no sirve para renovar sesión.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, requireEnv("JWT_REFRESH_SECRET"));
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("sub" in decoded) ||
    !("kind" in decoded) ||
    decoded.kind !== "refresh" ||
    !("jti" in decoded) ||
    typeof (decoded as { jti?: unknown }).jti !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Refresh token inválido");
  }
  return decoded as RefreshPayload;
}
