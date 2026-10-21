import jwt from "jsonwebtoken";

type AccessPayload = {
  sub: string;
  username: string;
  internalRol: string;
  businessId: string | null;
  v: number;
};

type RefreshPayload = {
  sub: string;
  v: number;
  kind: "refresh";
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno ${name}`);
  }
  return value;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, requireEnv("JWT_SECRET"), {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshPayload, "kind">): string {
  return jwt.sign(
    { ...payload, kind: "refresh" },
    requireEnv("JWT_REFRESH_SECRET"),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    } as jwt.SignOptions,
  );
}
