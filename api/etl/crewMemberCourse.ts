/**
 * ETL CrewMemberCourse:
 * Mongo (crewmembercourses) → Postgres (crew_member_courses).
 *
 * Uso:
 *   npm run etl:crew-member-course           # dry-run
 *   npm run etl:crew-member-course -- --apply
 *
 * Requiere etl:crew-member y etl:course previos.
 * Idempotente: upsert por legacyMongoId.
 * Solo lectura en Mongo.
 */

import {
  PrismaClient,
  type CrewCourseSource,
  type CrewCourseStatus,
} from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento asignación curso↔tripulante en Mongo. */
type MongoCrewMemberCourse = {
  _id: { toString(): string };
  crewMemberID?: { toString(): string } | string | null;
  courseID?: { toString(): string } | string | null;
  completedAt?: Date | null;
  expiresAt?: Date | null;
  status?: string | null;
  source?: string | null;
  lastExpiringEmailAt?: Date | null;
  lastExpiredEmailAt?: Date | null;
  expiringMilestonesSent?: number[] | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** Estados válidos en Prisma. */
const STATUS_SET = new Set<CrewCourseStatus>([
  "pending",
  "valid",
  "expiring_soon",
  "expired",
]);

/** Orígenes válidos en Prisma. */
const SOURCE_SET = new Set<CrewCourseSource>([
  "rank",
  "certificate",
  "manual",
]);

/** ObjectId o string → string. */
function idToString(
  value: { toString(): string } | string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : value.toString();
}

/** Mapea status Mongo → enum Wave (default pending). */
function mapStatus(raw: string | null | undefined): CrewCourseStatus {
  if (raw && STATUS_SET.has(raw as CrewCourseStatus)) {
    return raw as CrewCourseStatus;
  }
  return "pending";
}

/** Mapea source Mongo → enum Wave (default manual). */
function mapSource(raw: string | null | undefined): CrewCourseSource {
  if (raw && SOURCE_SET.has(raw as CrewCourseSource)) {
    return raw as CrewCourseSource;
  }
  return "manual";
}

/** Hitos de mail: solo enteros finitos. */
function mapMilestones(raw: number[] | null | undefined): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n));
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
  console.log(`[etl:crew-member-course] modo=${mode} db=${db.databaseName}`);

  try {
    const crews = await prisma.crewMember.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const crewByLegacy = new Map<string, string>();
    for (const c of crews) {
      if (c.legacyMongoId) crewByLegacy.set(c.legacyMongoId, c.id);
    }

    const courses = await prisma.course.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const courseByLegacy = new Map<string, string>();
    for (const c of courses) {
      if (c.legacyMongoId) courseByLegacy.set(c.legacyMongoId, c.id);
    }

    console.log(
      `[etl:crew-member-course] maps PG: crew=${crewByLegacy.size} course=${courseByLegacy.size}`,
    );

    const col = db.collection<MongoCrewMemberCourse>("crewmembercourses");
    const docs = await col.find({}).toArray();
    console.log(`[etl:crew-member-course] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const mongoCrewId = idToString(doc.crewMemberID);
      const mongoCourseId = idToString(doc.courseID);

      if (!mongoCrewId || !mongoCourseId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin crewMemberID o courseID`);
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

      const courseId = courseByLegacy.get(mongoCourseId);
      if (!courseId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: curso ${mongoCourseId} no está en Postgres`,
        );
        continue;
      }

      const payload = {
        crewMemberId,
        courseId,
        completedAt: doc.completedAt ?? null,
        expiresAt: doc.expiresAt ?? null,
        status: mapStatus(doc.status),
        source: mapSource(doc.source),
        lastExpiringEmailAt: doc.lastExpiringEmailAt ?? null,
        lastExpiredEmailAt: doc.lastExpiredEmailAt ?? null,
        expiringMilestonesSent: mapMilestones(doc.expiringMilestonesSent),
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.crewMemberCourse.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.crewMemberCourse.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      const samePair = await prisma.crewMemberCourse.findFirst({
        where: {
          deletedAt: null,
          crewMemberId,
          courseId,
        },
      });
      if (samePair) {
        await prisma.crewMemberCourse.update({
          where: { id: samePair.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.crewMemberCourse.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:crew-member-course] upsertables: ${wouldUpsert}`);
    console.log(`[etl:crew-member-course] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:crew-member-course] escritos (upsert): ${written}`);
      const totalPg = await prisma.crewMemberCourse.count();
      console.log(
        `[etl:crew-member-course] total en Postgres crew_member_courses: ${totalPg}`,
      );
    } else {
      console.log(
        "[etl:crew-member-course] dry-run OK. Para escribir: npm run etl:crew-member-course -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:crew-member-course] falló:", err);
  process.exit(1);
});
