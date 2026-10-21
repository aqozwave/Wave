import { PrismaClient } from "@prisma/client";

// Un solo cliente por proceso. Varias instancias agotan conexiones a Postgres.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
