/**
 * ETL Travesia: Mongo (colección travesias) → Postgres (tabla travesias).
 *
 * Uso:
 *   npm run etl:travesia           # dry-run
 *   npm run etl:travesia -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve businessID → businesses.legacyMongoId.
 * Único lógico: name + business (como portal viejo).
 * Omite docs sin name, requiredPassages válido (10|4) o businessID.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Cuotas de pasadas permitidas (misma regla que API Wave). */
const REQUIRED_PASSAGES_VALUES = [10, 4] as const;

/** Documento Travesia en Mongo (Prisma/core-api modelo Travesia). */
type MongoTravesia = {
  _id: { toString(): string };
  name?: string | null;
  requiredPassages?: number | null;
  businessID?: { toString(): string } | string | null;
  state?: boolean | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** Normaliza string vacío a null. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** Nombre en minúsculas (mismo criterio que API Wave). */
function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/** ¿Es cuota válida (10 o 4)? */
function isValidPassages(
  value: number | null | undefined,
): value is (typeof REQUIRED_PASSAGES_VALUES)[number] {
  if (value === undefined || value === null) return false;
  return (REQUIRED_PASSAGES_VALUES as readonly number[]).includes(value);
}

/** ObjectId o string → string. */
function idToString(
  value: { toString(): string } | string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : value.toString();
}

/** ¿Hay flag --apply en argv? */
function wantsApply(): boolean {
  return process.argv.includes("--apply");
}

async function main(): Promise<void> {
  const apply = wantsApply();
  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();

  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[etl:travesia] modo=${mode} db=${db.databaseName}`);

  try {
    const businesses = await prisma.business.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const businessByLegacy = new Map<string, string>();
    for (const b of businesses) {
      if (b.legacyMongoId) {
        businessByLegacy.set(b.legacyMongoId, b.id);
      }
    }
    console.log(
      `[etl:travesia] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoTravesia>("travesias");
    const docs = await col.find({}).toArray();
    console.log(`[etl:travesia] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const rawName = emptyToNull(doc.name);
      const mongoBusinessId = idToString(doc.businessID);

      if (!rawName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin name`);
        continue;
      }
      if (!isValidPassages(doc.requiredPassages)) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: requiredPassages inválido (${String(doc.requiredPassages)})`,
        );
        continue;
      }
      if (!mongoBusinessId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin businessID`);
        continue;
      }

      const businessId = businessByLegacy.get(mongoBusinessId);
      if (!businessId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: businessID ${mongoBusinessId} no está en Postgres (corré etl:business antes)`,
        );
        continue;
      }

      const name = normalizeName(rawName);
      const requiredPassages = doc.requiredPassages;
      const payload = {
        name,
        requiredPassages,
        businessId,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.travesia.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.travesia.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre activo en la misma empresa: reasignar legacy.
      const sameKey = await prisma.travesia.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (sameKey) {
        await prisma.travesia.update({
          where: { id: sameKey.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.travesia.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:travesia] upsertables: ${wouldUpsert}`);
    console.log(`[etl:travesia] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:travesia] escritos (upsert): ${written}`);
      const totalPg = await prisma.travesia.count();
      console.log(`[etl:travesia] total en Postgres travesias: ${totalPg}`);
    } else {
      console.log(
        "[etl:travesia] dry-run OK. Para escribir: npm run etl:travesia -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:travesia] falló:", err);
  process.exit(1);
});
