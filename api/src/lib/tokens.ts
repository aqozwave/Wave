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

/** Claims del refresh JWT; `kind` evita usarlo como access. */
export type RefreshPayload = {
  sub: string;
  v: number;
  kind: "refresh";
};

/** Lee un secreto obligatorio del entorno (falla temprano si falta). */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno ${name}`);
  }
  return value;
}

/** Firma el access token de vida corta (default 15m). */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, requireEnv("JWT_SECRET"), {
    // Default corto: reduce ventana si el token se filtra.
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  } as jwt.SignOptions);
}

/** Firma el refresh token de vida larga (default 7d). */
export function signRefreshToken(payload: Omit<RefreshPayload, "kind">): string {
  return jwt.sign(
    { ...payload, kind: "refresh" },
    requireEnv("JWT_REFRESH_SECRET"),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    } as jwt.SignOptions,
  );
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
 * Verifica el refresh token (secreto distinto + kind === "refresh").
 * Así un access JWT no sirve para renovar sesión.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, requireEnv("JWT_REFRESH_SECRET"));
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("sub" in decoded) ||
    !("kind" in decoded) ||
    decoded.kind !== "refresh"
  ) {
    throw new jwt.JsonWebTokenError("Refresh token inválido");
  }
  return decoded as RefreshPayload;
}
