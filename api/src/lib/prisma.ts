import { PrismaClient } from "@prisma/client";

/**
 * Conexiones simultáneas de este proceso hacia Postgres.
 * 10: el Postgres de Docker trae max_connections=100 y hay que dejar cupo
 * para Prisma Studio, el ETL y un segundo proceso.
 */
const DEFAULT_CONNECTION_LIMIT = 10;

/**
 * Segundos que una query espera si las 10 conexiones están ocupadas.
 * Después Prisma falla (P2024) en vez de encolar sin fin.
 */
const DEFAULT_POOL_TIMEOUT_SECONDS = 10;

/**
 * Entero ≥ 1 desde env. Si falta o no es válido, usa el default.
 */
function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

/**
 * Agrega connection_limit y pool_timeout si la URL no los trae.
 * No reparsea user/password: un carácter especial en la clave no se reencoda.
 * Si la URL ya define el parámetro, ese valor manda.
 */
export function databaseUrlWithPoolLimits(raw: string): string {
  const limit = readPositiveInt(
    process.env.PRISMA_CONNECTION_LIMIT,
    DEFAULT_CONNECTION_LIMIT,
  );
  const timeout = readPositiveInt(
    process.env.PRISMA_POOL_TIMEOUT,
    DEFAULT_POOL_TIMEOUT_SECONDS,
  );
  const hashAt = raw.indexOf("#");
  const withoutHash = hashAt === -1 ? raw : raw.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : raw.slice(hashAt);
  const queryAt = withoutHash.indexOf("?");
  const base = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const params = new URLSearchParams(
    queryAt === -1 ? "" : withoutHash.slice(queryAt + 1),
  );
  if (!params.has("connection_limit")) {
    params.set("connection_limit", String(limit));
  }
  if (!params.has("pool_timeout")) {
    params.set("pool_timeout", String(timeout));
  }
  return `${base}?${params.toString()}${hash}`;
}

// Un solo cliente por proceso. Varias instancias agotan conexiones a Postgres.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const databaseUrl = process.env.DATABASE_URL?.trim();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrlWithPoolLimits(databaseUrl) },
          },
        }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
