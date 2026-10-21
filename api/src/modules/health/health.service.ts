import type { HealthResponse } from "./health.schemas.js";

// El proceso está arriba. No mira la base: PostgreSQL entra con Prisma, en el paso siguiente.
export function getHealth(): HealthResponse {
  return { status: "ok" };
}
