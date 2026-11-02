/**
 * ETL SystemAnnouncement (+ lecturas): Mongo → Postgres.
 *
 * Uso:
 *   npm run etl:system-announcement           # dry-run
 *   npm run etl:system-announcement -- --apply
 *
 * 1) Colección systemannouncements → system_announcements (upsert legacyMongoId /
 *    dedupeKey).
 * 2) users.seenSystemAnnouncementIds → user_announcement_reads (si ambos
 *    extremos ya tienen legacy resuelto).
 * Solo lectura en Mongo.
 */

import {
  PrismaClient,
  type SystemAnnouncementKind,
} from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Kinds válidos en Wave. */
const KINDS = new Set<string>(["version", "maintenance", "config"]);

/** Documento SystemAnnouncement en Mongo. */
type MongoAnnouncement = {
  _id: { toString(): string };
  dedupeKey?: string | null;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  metadata?: unknown;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  createdBy?: { toString(): string } | string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** User Mongo solo para seen ids. */
type MongoUserSeen = {
  _id: { toString(): string };
  seenSystemAnnouncementIds?: Array<{ toString(): string } | string> | null;
};

/** Normaliza string vacío a null. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** ObjectId o string → string. */
function idToString(
  value: { toString(): string } | string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : value.toString();
}

/** ¿Hay flag --apply? */
function wantsApply(): boolean {
  return process.argv.includes("--apply");
}

async function main(): Promise<void> {
  const apply = wantsApply();
  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[etl:system-announcement] modo=${mode} db=${db.databaseName}`);

  try {
    const users = await prisma.user.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const userByLegacy = new Map<string, string>();
    for (const u of users) {
      if (u.legacyMongoId) userByLegacy.set(u.legacyMongoId, u.id);
    }

    // --- 1) Announcements ---
    const docs = await db
      .collection<MongoAnnouncement>("systemannouncements")
      .find({})
      .toArray();
    console.log(
      `[etl:system-announcement] documentos Mongo: ${docs.length}`,
    );

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const kindRaw = emptyToNull(doc.kind);
      const title = emptyToNull(doc.title);
      const body = emptyToNull(doc.body);

      if (!kindRaw || !KINDS.has(kindRaw)) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: kind inválido (${kindRaw})`);
        continue;
      }
      if (!title || !body) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin title/body`);
        continue;
      }

      const mongoCreatedBy = idToString(doc.createdBy);
      const createdById = mongoCreatedBy
        ? (userByLegacy.get(mongoCreatedBy) ?? null)
        : null;

      const metadata =
        doc.metadata === undefined || doc.metadata === null
          ? null
          : (doc.metadata as object);

      const dedupeKey = emptyToNull(doc.dedupeKey);
      const payload = {
        kind: kindRaw as SystemAnnouncementKind,
        title,
        body,
        metadata,
        publishedAt: doc.publishedAt ?? doc.createdAt ?? new Date(),
        expiresAt: doc.expiresAt ?? null,
        createdById,
        deletedAt: doc.deletedAt ?? null,
        dedupeKey,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.systemAnnouncement.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.systemAnnouncement.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      if (dedupeKey) {
        const byDedupe = await prisma.systemAnnouncement.findUnique({
          where: { dedupeKey },
        });
        if (byDedupe) {
          await prisma.systemAnnouncement.update({
            where: { id: byDedupe.id },
            data: { ...payload, legacyMongoId },
          });
          written += 1;
          continue;
        }
      }

      await prisma.systemAnnouncement.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:system-announcement] upsertables: ${wouldUpsert}`);
    console.log(`[etl:system-announcement] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons) console.log(`  - ${reason}`);
    }

    // Mapa legacy anuncio → uuid PG (tras writes de arriba).
    const announcements = await prisma.systemAnnouncement.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const annByLegacy = new Map<string, string>();
    for (const a of announcements) {
      if (a.legacyMongoId) annByLegacy.set(a.legacyMongoId, a.id);
    }
    // En dry-run, los Mongo ids upsertables cuentan como “existirán”.
    const upcomingAnnLegacy = new Set(docs.map((d) => d._id.toString()));

    // --- 2) Lecturas desde users.seenSystemAnnouncementIds ---
    const mongoUsers = await db
      .collection<MongoUserSeen>("users")
      .find(
        { seenSystemAnnouncementIds: { $exists: true, $ne: [] } },
        { projection: { seenSystemAnnouncementIds: 1 } },
      )
      .toArray();

    let readWould = 0;
    let readWritten = 0;
    let readSkipped = 0;

    for (const u of mongoUsers) {
      const userId = userByLegacy.get(u._id.toString());
      if (!userId) {
        readSkipped += (u.seenSystemAnnouncementIds ?? []).length;
        continue;
      }
      for (const raw of u.seenSystemAnnouncementIds ?? []) {
        const mongoAnnId = idToString(raw);
        if (!mongoAnnId) continue;
        const announcementId = annByLegacy.get(mongoAnnId);
        const willExist =
          Boolean(announcementId) || upcomingAnnLegacy.has(mongoAnnId);
        if (!willExist) {
          readSkipped += 1;
          continue;
        }
        readWould += 1;
        if (!apply || !announcementId) continue;

        await prisma.userAnnouncementRead.upsert({
          where: {
            userId_announcementId: { userId, announcementId },
          },
          create: { userId, announcementId },
          update: {},
        });
        readWritten += 1;
      }
    }

    console.log(
      `[etl:system-announcement] lecturas upsertables≈${readWould} omitidas≈${readSkipped}`,
    );

    if (apply) {
      console.log(`[etl:system-announcement] anuncios escritos: ${written}`);
      console.log(`[etl:system-announcement] lecturas escritas: ${readWritten}`);
      const total = await prisma.systemAnnouncement.count();
      const reads = await prisma.userAnnouncementRead.count();
      console.log(
        `[etl:system-announcement] total PG announcements=${total} reads=${reads}`,
      );
    } else {
      console.log(
        "[etl:system-announcement] dry-run OK. Para escribir: npm run etl:system-announcement -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:system-announcement] falló:", err);
  process.exit(1);
});
