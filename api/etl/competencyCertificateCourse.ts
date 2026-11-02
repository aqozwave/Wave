/**
 * ETL CompetencyCertificateCourse:
 * Mongo (competencycertificatecourses) → Postgres (competency_certificate_courses).
 *
 * Uso:
 *   npm run etl:competency-certificate-course           # dry-run
 *   npm run etl:competency-certificate-course -- --apply
 *
 * Requiere etl:competency-certificate y etl:course previos.
 * Idempotente: upsert por legacyMongoId.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento join título↔curso en Mongo. */
type MongoCompetencyCertificateCourse = {
  _id: { toString(): string };
  competencyCertificateID?: { toString(): string } | string | null;
  courseID?: { toString(): string } | string | null;
  isMandatory?: boolean | null;
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
  console.log(
    `[etl:competency-certificate-course] modo=${mode} db=${db.databaseName}`,
  );

  try {
    const certs = await prisma.competencyCertificate.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const certByLegacy = new Map<string, string>();
    for (const c of certs) {
      if (c.legacyMongoId) certByLegacy.set(c.legacyMongoId, c.id);
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
      `[etl:competency-certificate-course] maps PG: cert=${certByLegacy.size} course=${courseByLegacy.size}`,
    );

    const col = db.collection<MongoCompetencyCertificateCourse>(
      "competencycertificatecourses",
    );
    const docs = await col.find({}).toArray();
    console.log(
      `[etl:competency-certificate-course] documentos Mongo: ${docs.length}`,
    );

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const mongoCertId = idToString(doc.competencyCertificateID);
      const mongoCourseId = idToString(doc.courseID);

      if (!mongoCertId || !mongoCourseId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: sin competencyCertificateID o courseID`,
        );
        continue;
      }

      const competencyCertificateId = certByLegacy.get(mongoCertId);
      if (!competencyCertificateId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: título ${mongoCertId} no está en Postgres`,
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
        competencyCertificateId,
        courseId,
        isMandatory: doc.isMandatory !== false,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.competencyCertificateCourse.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.competencyCertificateCourse.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Mismo par activo: reasignar legacy (idempotencia sin duplicar).
      const samePair = await prisma.competencyCertificateCourse.findFirst({
        where: {
          deletedAt: null,
          competencyCertificateId,
          courseId,
        },
      });
      if (samePair) {
        await prisma.competencyCertificateCourse.update({
          where: { id: samePair.id },
          data: { ...payload, legacyMongoId },
        });
        written += 1;
        continue;
      }

      await prisma.competencyCertificateCourse.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(
      `[etl:competency-certificate-course] upsertables: ${wouldUpsert}`,
    );
    console.log(`[etl:competency-certificate-course] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(
        `[etl:competency-certificate-course] escritos (upsert): ${written}`,
      );
      const totalPg = await prisma.competencyCertificateCourse.count();
      console.log(
        `[etl:competency-certificate-course] total en Postgres: ${totalPg}`,
      );
    } else {
      console.log(
        "[etl:competency-certificate-course] dry-run OK. Para escribir: npm run etl:competency-certificate-course -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:competency-certificate-course] falló:", err);
  process.exit(1);
});
