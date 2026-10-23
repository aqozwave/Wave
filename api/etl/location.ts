/**
 * ETL Location: Mongo (colección locations) → Postgres (tabla locations).
 *
 * Uso:
 *   npm run etl:location           # dry-run (no escribe)
 *   npm run etl:location -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * kind queda null (sin clasificar); se completa después en Wave.
 * Requiere businesses ya migrados (FK por legacyMongoId de businessID).
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Location en Mongo (Prisma/core-api modelo Location). */
type MongoLocation = {
  _id: { toString(): string };
  name?: string | null;
  businessID?: { toString(): string } | string | null;
  country?: string | null;
  commune?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
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

/** Nombre en minúsculas (mismo criterio que API Wave / portal viejo). */
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
  console.log(`[etl:location] modo=${mode} db=${db.databaseName}`);

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
      `[etl:location] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoLocation>("locations");
    const docs = await col.find({}).toArray();
    console.log(`[etl:location] documentos Mongo: ${docs.length}`);

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
        // ETL no clasifica: null = sin clasificar (vessel/office/… en Wave).
        kind: null as null,
        businessId,
        country: emptyToNull(doc.country) ?? "Chile",
        commune: emptyToNull(doc.commune),
        city: emptyToNull(doc.city),
        phone: emptyToNull(doc.phone),
        email: emptyToNull(doc.email)?.toLowerCase() ?? null,
        description: emptyToNull(doc.description),
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;

      if (!apply) {
        continue;
      }

      const byLegacy = await prisma.location.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.location.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo nombre activo en la misma empresa (otro _id): reasignar legacy.
      const sameName = await prisma.location.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (sameName) {
        await prisma.location.update({
          where: { id: sameName.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.location.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:location] upsertables: ${wouldUpsert}`);
    console.log(`[etl:location] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:location] escritos (upsert): ${written}`);
      const totalPg = await prisma.location.count();
      const nullKind = await prisma.location.count({ where: { kind: null } });
      console.log(`[etl:location] total en Postgres locations: ${totalPg}`);
      console.log(`[etl:location] con kind null: ${nullKind}`);
    } else {
      console.log(
        "[etl:location] dry-run OK. Para escribir: npm run etl:location -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:location] falló:", err);
  process.exit(1);
});
