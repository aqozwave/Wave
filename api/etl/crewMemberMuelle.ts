/**
 * ETL CrewMemberMuelle: Mongo (crewmembermuelles) → Postgres (crew_member_muelles).
 *
 * Uso:
 *   npm run etl:crew-member-muelle           # dry-run
 *   npm run etl:crew-member-muelle -- --apply
 *
 * Requiere etl:crew-member y etl:muelle previos.
 * Idempotente: upsert por legacyMongoId.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento asignación muelle en Mongo. */
type MongoCrewMemberMuelle = {
  _id: { toString(): string };
  crewMemberID?: { toString(): string } | string | null;
  muelleID?: { toString(): string } | string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

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
  console.log(`[etl:crew-member-muelle] modo=${mode} db=${db.databaseName}`);

  try {
    const crews = await prisma.crewMember.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const crewByLegacy = new Map<string, string>();
    for (const c of crews) {
      if (c.legacyMongoId) crewByLegacy.set(c.legacyMongoId, c.id);
    }

    const muelles = await prisma.muelle.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const muelleByLegacy = new Map<string, string>();
    for (const m of muelles) {
      if (m.legacyMongoId) muelleByLegacy.set(m.legacyMongoId, m.id);
    }

    console.log(
      `[etl:crew-member-muelle] maps PG: crew=${crewByLegacy.size} muelle=${muelleByLegacy.size}`,
    );

    const col = db.collection<MongoCrewMemberMuelle>("crewmembermuelles");
    const docs = await col.find({}).toArray();
    console.log(`[etl:crew-member-muelle] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const mongoCrewId = idToString(doc.crewMemberID);
      const mongoMuelleId = idToString(doc.muelleID);

      if (!mongoCrewId || !mongoMuelleId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin crewMemberID o muelleID`);
        continue;
      }

      const crewMemberId = crewByLegacy.get(mongoCrewId);
      if (!crewMemberId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: crew ${mongoCrewId} no está en Postgres`,
        );
        continue;
      }

      const muelleId = muelleByLegacy.get(mongoMuelleId);
      if (!muelleId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: muelle ${mongoMuelleId} no está en Postgres`,
        );
        continue;
      }

      const payload = {
        crewMemberId,
        muelleId,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.crewMemberMuelle.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.crewMemberMuelle.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo par activo: reasignar legacy.
      const samePair = await prisma.crewMemberMuelle.findFirst({
        where: {
          deletedAt: null,
          crewMemberId,
          muelleId,
        },
      });
      if (samePair) {
        await prisma.crewMemberMuelle.update({
          where: { id: samePair.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.crewMemberMuelle.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:crew-member-muelle] upsertables: ${wouldUpsert}`);
    console.log(`[etl:crew-member-muelle] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:crew-member-muelle] escritos (upsert): ${written}`);
      const totalPg = await prisma.crewMemberMuelle.count();
      console.log(
        `[etl:crew-member-muelle] total en Postgres crew_member_muelles: ${totalPg}`,
      );
    } else {
      console.log(
        "[etl:crew-member-muelle] dry-run OK. Para escribir: npm run etl:crew-member-muelle -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:crew-member-muelle] falló:", err);
  process.exit(1);
});
