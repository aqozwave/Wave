/**
 * ETL CrewMember: Mongo (colección crewmembers) → Postgres (tabla crew_members).
 *
 * Uso:
 *   npm run etl:crew-member           # dry-run
 *   npm run etl:crew-member -- --apply
 *
 * Idempotente: upsert por legacyMongoId (= Mongo _id).
 * Resuelve FKs por legacyMongoId de catálogos ya migrados.
 * businessId + locationId obligatorios; el resto opcional (null si falta).
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento CrewMember en Mongo (Prisma/core-api modelo CrewMember). */
type MongoCrewMember = {
  _id: { toString(): string };
  run?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  birthDate?: Date | null;
  nationality?: string | null;
  phone?: string | null;
  direction?: string | null;
  observation?: string | null;
  boardingBookValidUntil?: Date | null;
  businessID?: { toString(): string } | string | null;
  locationID?: { toString(): string } | string | null;
  areaID?: { toString(): string } | string | null;
  rankID?: { toString(): string } | string | null;
  academicDegreeID?: { toString(): string } | string | null;
  competencyCertificateID?: { toString(): string } | string | null;
  userID?: { toString(): string } | string | null;
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

/** Texto en minúsculas (mismo criterio que portal viejo / API Wave). */
function normalizeLower(value: string): string {
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

/** Carga mapa legacyMongoId → uuid Postgres. */
async function loadLegacyMap(
  prisma: PrismaClient,
  model:
    | "business"
    | "location"
    | "area"
    | "rank"
    | "academicDegree"
    | "competencyCertificate"
    | "user",
): Promise<Map<string, string>> {
  const rows = await prisma[model].findMany({
    where: { legacyMongoId: { not: null } },
    select: { id: true, legacyMongoId: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.legacyMongoId) map.set(row.legacyMongoId, row.id);
  }
  return map;
}

async function main(): Promise<void> {
  const apply = wantsApply();
  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();

  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[etl:crew-member] modo=${mode} db=${db.databaseName}`);

  try {
    const businessByLegacy = await loadLegacyMap(prisma, "business");
    const locationByLegacy = await loadLegacyMap(prisma, "location");
    const areaByLegacy = await loadLegacyMap(prisma, "area");
    const rankByLegacy = await loadLegacyMap(prisma, "rank");
    const degreeByLegacy = await loadLegacyMap(prisma, "academicDegree");
    const certByLegacy = await loadLegacyMap(prisma, "competencyCertificate");
    const userByLegacy = await loadLegacyMap(prisma, "user");

    console.log(
      `[etl:crew-member] maps PG: biz=${businessByLegacy.size} loc=${locationByLegacy.size} area=${areaByLegacy.size} rank=${rankByLegacy.size} degree=${degreeByLegacy.size} cert=${certByLegacy.size} user=${userByLegacy.size}`,
    );

    const col = db.collection<MongoCrewMember>("crewmembers");
    const docs = await col.find({}).toArray();
    console.log(`[etl:crew-member] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    let optionalFkDropped = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const run = emptyToNull(doc.run);
      const firstNameRaw = emptyToNull(doc.firstName);
      const lastNameRaw = emptyToNull(doc.lastName);
      const emailRaw = emptyToNull(doc.email);
      const boardingBookValidUntil = doc.boardingBookValidUntil ?? null;
      const mongoBusinessId = idToString(doc.businessID);
      const mongoLocationId = idToString(doc.locationID);

      if (!run) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin run`);
        continue;
      }
      if (!firstNameRaw || !lastNameRaw) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin firstName/lastName`);
        continue;
      }
      if (!emailRaw) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin email`);
        continue;
      }
      if (!boardingBookValidUntil) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin boardingBookValidUntil`);
        continue;
      }
      if (!mongoBusinessId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin businessID`);
        continue;
      }
      if (!mongoLocationId) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin locationID`);
        continue;
      }

      const businessId = businessByLegacy.get(mongoBusinessId);
      if (!businessId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: businessID ${mongoBusinessId} no está en Postgres`,
        );
        continue;
      }

      const locationId = locationByLegacy.get(mongoLocationId);
      if (!locationId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: locationID ${mongoLocationId} no está en Postgres`,
        );
        continue;
      }

      // FKs opcionales: si el catálogo no migró, se deja null (no aborta la fila).
      const mongoAreaId = idToString(doc.areaID);
      const mongoRankId = idToString(doc.rankID);
      const mongoDegreeId = idToString(doc.academicDegreeID);
      const mongoCertId = idToString(doc.competencyCertificateID);
      const mongoUserId = idToString(doc.userID);

      let areaId: string | null = null;
      if (mongoAreaId) {
        areaId = areaByLegacy.get(mongoAreaId) ?? null;
        if (!areaId) optionalFkDropped += 1;
      }

      let rankId: string | null = null;
      if (mongoRankId) {
        rankId = rankByLegacy.get(mongoRankId) ?? null;
        if (!rankId) optionalFkDropped += 1;
      }

      let academicDegreeId: string | null = null;
      if (mongoDegreeId) {
        academicDegreeId = degreeByLegacy.get(mongoDegreeId) ?? null;
        if (!academicDegreeId) optionalFkDropped += 1;
      }

      let competencyCertificateId: string | null = null;
      if (mongoCertId) {
        competencyCertificateId = certByLegacy.get(mongoCertId) ?? null;
        if (!competencyCertificateId) optionalFkDropped += 1;
      }

      let userId: string | null = null;
      if (mongoUserId) {
        userId = userByLegacy.get(mongoUserId) ?? null;
        if (!userId) optionalFkDropped += 1;
      }

      const payload = {
        run: run.trim(),
        firstName: normalizeLower(firstNameRaw),
        lastName: normalizeLower(lastNameRaw),
        email: normalizeLower(emailRaw),
        birthDate: doc.birthDate ?? null,
        nationality: emptyToNull(doc.nationality),
        phone: emptyToNull(doc.phone),
        direction: emptyToNull(doc.direction)
          ? normalizeLower(doc.direction!)
          : null,
        observation: emptyToNull(doc.observation),
        boardingBookValidUntil,
        businessId,
        locationId,
        areaId,
        rankId,
        academicDegreeId,
        competencyCertificateId,
        userId,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.crewMember.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.crewMember.update({
          where: { id: byLegacy.id },
          data: {
            ...payload,
            // No pisar userId con null si el PG ya tiene vínculo local.
            userId:
              payload.userId !== null
                ? payload.userId
                : byLegacy.userId,
          },
        });
        written += 1;
        continue;
      }

      // Mismo RUN activo en la misma empresa: reasignar legacy.
      const sameRun = await prisma.crewMember.findFirst({
        where: {
          deletedAt: null,
          businessId,
          run: { equals: payload.run, mode: "insensitive" },
        },
      });
      if (sameRun) {
        await prisma.crewMember.update({
          where: { id: sameRun.id },
          data: {
            ...payload,
            legacyMongoId,
            userId:
              payload.userId !== null ? payload.userId : sameRun.userId,
          },
        });
        written += 1;
        continue;
      }

      await prisma.crewMember.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:crew-member] upsertables: ${wouldUpsert}`);
    console.log(`[etl:crew-member] omitidos: ${skipped}`);
    console.log(
      `[etl:crew-member] FKs opcionales caídas a null: ${optionalFkDropped}`,
    );
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 20)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 20) {
        console.log(`  … y ${skipReasons.length - 20} más`);
      }
    }

    if (apply) {
      console.log(`[etl:crew-member] escritos (upsert): ${written}`);
      const totalPg = await prisma.crewMember.count();
      const withLegacy = await prisma.crewMember.count({
        where: { legacyMongoId: { not: null } },
      });
      console.log(
        `[etl:crew-member] total en Postgres crew_members: ${totalPg} (con legacy: ${withLegacy})`,
      );
    } else {
      console.log(
        "[etl:crew-member] dry-run OK. Para escribir: npm run etl:crew-member -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:crew-member] falló:", err);
  process.exit(1);
});
