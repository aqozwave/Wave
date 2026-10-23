/**
 * ETL Area: Mongo (colección areas) → Postgres (tabla areas).
 *
 * Uso:
 *   npm run etl:area           # dry-run
 *   npm run etl:area -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve locationID → locations.legacyMongoId → businessId de esa location.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Area en Mongo (Prisma/core-api modelo Area). */
type MongoArea = {
  _id: { toString(): string };
  name?: string | null;
  locationID?: { toString(): string } | string | null;
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
  console.log(`[etl:area] modo=${mode} db=${db.databaseName}`);

  try {
    // Mapa Mongo location _id → { id, businessId } en Postgres
    const locations = await prisma.location.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true, businessId: true },
    });
    const locationByLegacy = new Map<
      string,
      { id: string; businessId: string }
    >();
    for (const loc of locations) {
      if (loc.legacyMongoId) {
        locationByLegacy.set(loc.legacyMongoId, {
          id: loc.id,
          businessId: loc.businessId,
        });
      }
    }
    console.log(
      `[etl:area] locations con legacyMongoId en PG: ${locationByLegacy.size}`,
    );

    const col = db.collection<MongoArea>("areas");
    const docs = await col.find({}).toArray();
    console.log(`[etl:area] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const rawName = emptyToNull(doc.name);
      const mongoLocationId = idToString(doc.locationID);

      if (!rawName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin name`);
        continue;
      }
      if (!mongoLocationId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin locationID`);
        continue;
      }

      const location = locationByLegacy.get(mongoLocationId);
      if (!location) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: locationID ${mongoLocationId} no está en Postgres (corré etl:location antes)`,
        );
        continue;
      }

      const name = normalizeName(rawName);
      const payload = {
        name,
        locationId: location.id,
        businessId: location.businessId,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.area.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.area.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre activo en la misma location: reasignar legacy.
      const sameName = await prisma.area.findFirst({
        where: {
          deletedAt: null,
          locationId: location.id,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (sameName) {
        await prisma.area.update({
          where: { id: sameName.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.area.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:area] upsertables: ${wouldUpsert}`);
    console.log(`[etl:area] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:area] escritos (upsert): ${written}`);
      const totalPg = await prisma.area.count();
      console.log(`[etl:area] total en Postgres areas: ${totalPg}`);
    } else {
      console.log(
        "[etl:area] dry-run OK. Para escribir: npm run etl:area -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:area] falló:", err);
  process.exit(1);
});
