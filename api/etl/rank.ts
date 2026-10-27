/**
 * ETL Rank: Mongo (colección ranks) → Postgres (tabla ranks).
 *
 * Uso:
 *   npm run etl:rank           # dry-run
 *   npm run etl:rank -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve businessID → businesses.legacyMongoId.
 * Omite docs sin name o sin businessID (Wave exige empresa).
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Rank en Mongo (Prisma/core-api modelo Rank). */
type MongoRank = {
  _id: { toString(): string };
  name?: string | null;
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
  console.log(`[etl:rank] modo=${mode} db=${db.databaseName}`);

  try {
    // Mapa Mongo business _id → Postgres business.id
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
      `[etl:rank] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoRank>("ranks");
    const docs = await col.find({}).toArray();
    console.log(`[etl:rank] documentos Mongo: ${docs.length}`);

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
      const payload = {
        name,
        businessId,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.rank.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.rank.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre activo en la misma empresa: reasignar legacy.
      const sameName = await prisma.rank.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (sameName) {
        await prisma.rank.update({
          where: { id: sameName.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.rank.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:rank] upsertables: ${wouldUpsert}`);
    console.log(`[etl:rank] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:rank] escritos (upsert): ${written}`);
      const totalPg = await prisma.rank.count();
      console.log(`[etl:rank] total en Postgres ranks: ${totalPg}`);
    } else {
      console.log(
        "[etl:rank] dry-run OK. Para escribir: npm run etl:rank -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:rank] falló:", err);
  process.exit(1);
});
