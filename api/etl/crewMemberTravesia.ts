/**
 * ETL CrewMemberTravesia: Mongo (crewmembertravesias) → Postgres (crew_member_travesias).
 *
 * Uso:
 *   npm run etl:crew-member-travesia           # dry-run
 *   npm run etl:crew-member-travesia -- --apply
 *
 * Requiere etl:crew-member y etl:travesia previos.
 * Idempotente: upsert por legacyMongoId.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento asignación travesía en Mongo. */
type MongoCrewMemberTravesia = {
  _id: { toString(): string };
  crewMemberID?: { toString(): string } | string | null;
  travesiaID?: { toString(): string } | string | null;
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
  console.log(`[etl:crew-member-travesia] modo=${mode} db=${db.databaseName}`);

  try {
    const crews = await prisma.crewMember.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const crewByLegacy = new Map<string, string>();
    for (const c of crews) {
      if (c.legacyMongoId) crewByLegacy.set(c.legacyMongoId, c.id);
    }

    const travesias = await prisma.travesia.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const travesiaByLegacy = new Map<string, string>();
    for (const t of travesias) {
      if (t.legacyMongoId) travesiaByLegacy.set(t.legacyMongoId, t.id);
    }

    console.log(
      `[etl:crew-member-travesia] maps PG: crew=${crewByLegacy.size} travesia=${travesiaByLegacy.size}`,
    );

    const col = db.collection<MongoCrewMemberTravesia>("crewmembertravesias");
    const docs = await col.find({}).toArray();
    console.log(`[etl:crew-member-travesia] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const mongoCrewId = idToString(doc.crewMemberID);
      const mongoTravesiaId = idToString(doc.travesiaID);

      if (!mongoCrewId || !mongoTravesiaId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin crewMemberID o travesiaID`);
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

      const travesiaId = travesiaByLegacy.get(mongoTravesiaId);
      if (!travesiaId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: travesia ${mongoTravesiaId} no está en Postgres`,
        );
        continue;
      }

      const payload = {
        crewMemberId,
        travesiaId,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.crewMemberTravesia.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.crewMemberTravesia.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      const samePair = await prisma.crewMemberTravesia.findFirst({
        where: {
          deletedAt: null,
          crewMemberId,
          travesiaId,
        },
      });
      if (samePair) {
        await prisma.crewMemberTravesia.update({
          where: { id: samePair.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.crewMemberTravesia.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:crew-member-travesia] upsertables: ${wouldUpsert}`);
    console.log(`[etl:crew-member-travesia] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:crew-member-travesia] escritos (upsert): ${written}`);
      const totalPg = await prisma.crewMemberTravesia.count();
      console.log(
        `[etl:crew-member-travesia] total en Postgres crew_member_travesias: ${totalPg}`,
      );
    } else {
      console.log(
        "[etl:crew-member-travesia] dry-run OK. Para escribir: npm run etl:crew-member-travesia -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:crew-member-travesia] falló:", err);
  process.exit(1);
});
