/**
 * ETL Business: Mongo (colección businesses) → Postgres (tabla businesses).
 *
 * Uso:
 *   npm run etl:business           # dry-run (no escribe)
 *   npm run etl:business -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Business en Mongo (Prisma/core-api modelo Business). */
type MongoBusiness = {
  _id: { toString(): string };
  rut?: string | null;
  name?: string | null;
  giro?: string | null;
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

/** ¿Hay flag --apply en argv? */
function wantsApply(): boolean {
  return process.argv.includes("--apply");
}

async function main(): Promise<void> {
  const apply = wantsApply();
  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();

  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[etl:business] modo=${mode} db=${db.databaseName}`);

  try {
    const col = db.collection<MongoBusiness>("businesses");
    const docs = await col.find({}).toArray();
    console.log(`[etl:business] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const name = emptyToNull(doc.name);

      if (!name) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin name`);
        continue;
      }

      const data = {
        rut: emptyToNull(doc.rut),
        name,
        giro: emptyToNull(doc.giro),
        country: emptyToNull(doc.country) ?? "Chile",
        commune: emptyToNull(doc.commune),
        city: emptyToNull(doc.city),
        phone: emptyToNull(doc.phone),
        email: emptyToNull(doc.email)?.toLowerCase() ?? null,
        description: emptyToNull(doc.description),
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt ?? undefined,
        updatedAt: doc.updatedAt ?? undefined,
      };

      wouldUpsert += 1;

      if (!apply) {
        continue;
      }

      const payload = {
        rut: data.rut,
        name: data.name,
        giro: data.giro,
        country: data.country,
        commune: data.commune,
        city: data.city,
        phone: data.phone,
        email: data.email,
        description: data.description,
        state: data.state,
        deletedAt: data.deletedAt,
      };

      // 1) Upsert por legacyMongoId (camino feliz / re-runs).
      const byLegacy = await prisma.business.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.business.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // 2) Mismo nombre activo con otro _id (p. ej. vino de core-api):
      //    reasignar legacyMongoId al de esta BD Mongo y actualizar campos.
      const sameName = await prisma.business.findFirst({
        where: {
          deletedAt: null,
          name: { equals: data.name, mode: "insensitive" },
        },
      });
      if (sameName) {
        await prisma.business.update({
          where: { id: sameName.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      // 3) Alta nueva.
      await prisma.business.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:business] upsertables: ${wouldUpsert}`);
    console.log(`[etl:business] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:business] escritos (upsert): ${written}`);
      const totalPg = await prisma.business.count();
      console.log(`[etl:business] total en Postgres businesses: ${totalPg}`);
    } else {
      console.log(
        "[etl:business] dry-run OK. Para escribir: npm run etl:business -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:business] falló:", err);
  process.exit(1);
});
