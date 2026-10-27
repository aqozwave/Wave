/**
 * ETL Muelle: Mongo (colección muelles) → Postgres (tabla muelles).
 *
 * Uso:
 *   npm run etl:muelle           # dry-run
 *   npm run etl:muelle -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve businessID → businesses.legacyMongoId.
 * Único lógico: name + portName + business (como portal viejo).
 * Omite docs sin name, portName o businessID.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Muelle en Mongo (Prisma/core-api modelo Muelle). */
type MongoMuelle = {
  _id: { toString(): string };
  name?: string | null;
  portName?: string | null;
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

/**
 * Puerto: trim, conserva casing (API Wave no fuerza lower;
 * unicidad lógica coincide con portal viejo).
 */
function normalizePortName(value: string): string {
  return value.trim();
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
  console.log(`[etl:muelle] modo=${mode} db=${db.databaseName}`);

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
      `[etl:muelle] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoMuelle>("muelles");
    const docs = await col.find({}).toArray();
    console.log(`[etl:muelle] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const rawName = emptyToNull(doc.name);
      const rawPort = emptyToNull(doc.portName);
      const mongoBusinessId = idToString(doc.businessID);

      if (!rawName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin name`);
        continue;
      }
      if (!rawPort) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin portName`);
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
      const portName = normalizePortName(rawPort);
      const payload = {
        name,
        portName,
        businessId,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.muelle.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.muelle.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre + puerto activo en la misma empresa: reasignar legacy.
      const sameKey = await prisma.muelle.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
          portName: { equals: portName, mode: "insensitive" },
        },
      });
      if (sameKey) {
        await prisma.muelle.update({
          where: { id: sameKey.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.muelle.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:muelle] upsertables: ${wouldUpsert}`);
    console.log(`[etl:muelle] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:muelle] escritos (upsert): ${written}`);
      const totalPg = await prisma.muelle.count();
      console.log(`[etl:muelle] total en Postgres muelles: ${totalPg}`);
    } else {
      console.log(
        "[etl:muelle] dry-run OK. Para escribir: npm run etl:muelle -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:muelle] falló:", err);
  process.exit(1);
});
