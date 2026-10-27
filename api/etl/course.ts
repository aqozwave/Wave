/**
 * ETL Course: Mongo (colección courses) → Postgres (tabla courses).
 *
 * Uso:
 *   npm run etl:course           # dry-run
 *   npm run etl:course -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve businessID → businesses.legacyMongoId.
 * Único lógico: name + whereTaught + business (como portal viejo).
 * Omite docs sin name, whereTaught o businessID.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Course en Mongo (Prisma/core-api modelo Course). */
type MongoCourse = {
  _id: { toString(): string };
  name?: string | null;
  whereTaught?: string | null;
  businessID?: { toString(): string } | string | null;
  description?: string | null;
  isMandatory?: boolean | null;
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

/** Nombre / lugar en minúsculas (mismo criterio que API Wave). */
function normalizeText(value: string): string {
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
  console.log(`[etl:course] modo=${mode} db=${db.databaseName}`);

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
      `[etl:course] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoCourse>("courses");
    const docs = await col.find({}).toArray();
    console.log(`[etl:course] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const rawName = emptyToNull(doc.name);
      const rawWhere = emptyToNull(doc.whereTaught);
      const mongoBusinessId = idToString(doc.businessID);

      if (!rawName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin name`);
        continue;
      }
      if (!rawWhere) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin whereTaught`);
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

      const name = normalizeText(rawName);
      const whereTaught = normalizeText(rawWhere);
      const payload = {
        name,
        whereTaught,
        businessId,
        description: emptyToNull(doc.description),
        isMandatory: doc.isMandatory ?? true,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.course.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.course.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre + lugar activo en la misma empresa: reasignar legacy.
      const sameKey = await prisma.course.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
          whereTaught: { equals: whereTaught, mode: "insensitive" },
        },
      });
      if (sameKey) {
        await prisma.course.update({
          where: { id: sameKey.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.course.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:course] upsertables: ${wouldUpsert}`);
    console.log(`[etl:course] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:course] escritos (upsert): ${written}`);
      const totalPg = await prisma.course.count();
      console.log(`[etl:course] total en Postgres courses: ${totalPg}`);
    } else {
      console.log(
        "[etl:course] dry-run OK. Para escribir: npm run etl:course -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:course] falló:", err);
  process.exit(1);
});
