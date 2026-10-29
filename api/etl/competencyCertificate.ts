/**
 * ETL CompetencyCertificate: Mongo (competencycertificates) → Postgres.
 *
 * Uso:
 *   npm run etl:competency-certificate           # dry-run
 *   npm run etl:competency-certificate -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve businessID → businesses.legacyMongoId.
 * Migra officerKind (captain | first_pilot); valores inválidos → null.
 * requiresMuelleTravesia = true si officerKind es captain o first_pilot.
 * Omite docs sin name o sin businessID.
 * Solo lectura en Mongo.
 */

import { PrismaClient, type OfficerKind } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Valores válidos de OfficerKind en Wave. */
const OFFICER_KINDS = new Set<string>(["captain", "first_pilot"]);

/** Documento CompetencyCertificate en Mongo. */
type MongoCompetencyCertificate = {
  _id: { toString(): string };
  name?: string | null;
  businessID?: { toString(): string } | string | null;
  officerKind?: string | null;
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

/** officerKind Mongo → enum Prisma o null. */
function normalizeOfficerKind(
  value: string | null | undefined,
): OfficerKind | null {
  if (!value) return null;
  const t = value.trim();
  if (!OFFICER_KINDS.has(t)) return null;
  return t as OfficerKind;
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
  console.log(`[etl:competency-certificate] modo=${mode} db=${db.databaseName}`);

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
      `[etl:competency-certificate] businesses con legacyMongoId en PG: ${businessByLegacy.size}`,
    );

    const col = db.collection<MongoCompetencyCertificate>(
      "competencycertificates",
    );
    const docs = await col.find({}).toArray();
    console.log(
      `[etl:competency-certificate] documentos Mongo: ${docs.length}`,
    );

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
      const officerKind = normalizeOfficerKind(doc.officerKind);
      const payload = {
        name,
        businessId,
        officerKind,
        // Misma regla de backfill que la migración: oficiales de nave → exigir.
        requiresMuelleTravesia:
          officerKind === "captain" || officerKind === "first_pilot",
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.competencyCertificate.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.competencyCertificate.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      const sameName = await prisma.competencyCertificate.findFirst({
        where: {
          deletedAt: null,
          businessId,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (sameName) {
        await prisma.competencyCertificate.update({
          where: { id: sameName.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.competencyCertificate.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:competency-certificate] upsertables: ${wouldUpsert}`);
    console.log(`[etl:competency-certificate] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:competency-certificate] escritos (upsert): ${written}`);
      const totalPg = await prisma.competencyCertificate.count();
      console.log(
        `[etl:competency-certificate] total en Postgres competency_certificates: ${totalPg}`,
      );
    } else {
      console.log(
        "[etl:competency-certificate] dry-run OK. Para escribir: npm run etl:competency-certificate -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:competency-certificate] falló:", err);
  process.exit(1);
});
