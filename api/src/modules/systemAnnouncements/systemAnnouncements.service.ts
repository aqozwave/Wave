import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { VERSION_ANNOUNCEMENT_CATALOG } from "./systemAnnouncements.catalog.js";
import type {
  ListSystemAnnouncementsQuery,
  SystemAnnouncementItem,
} from "./systemAnnouncements.schemas.js";

/** Filtro de avisos activos (publicados y no vencidos). */
function activeWhere(now = new Date()): Prisma.SystemAnnouncementWhereInput {
  return {
    deletedAt: null,
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

/**
 * Upsert del catálogo de versiones (idempotente por dedupeKey).
 */
async function ensureVersionCatalog(): Promise<void> {
  for (const entry of VERSION_ANNOUNCEMENT_CATALOG) {
    await prisma.systemAnnouncement.upsert({
      where: { dedupeKey: entry.dedupeKey },
      create: {
        dedupeKey: entry.dedupeKey,
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        publishedAt: new Date(entry.publishedAt),
      },
      update: {},
    });
  }
}

/** Mapea fila + set de leídos → ítem API. */
function toItem(
  row: {
    id: string;
    kind: SystemAnnouncementItem["kind"];
    title: string;
    body: string;
    metadata: Prisma.JsonValue | null;
    publishedAt: Date;
  },
  seen: Set<string>,
): SystemAnnouncementItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    metadata: row.metadata,
    publishedAt: row.publishedAt.toISOString(),
    read: seen.has(row.id),
  };
}

/**
 * Lista avisos activos para el usuario + unreadCount.
 */
export async function listAnnouncementsForUser(
  userId: string,
  query: ListSystemAnnouncementsQuery,
): Promise<{ items: SystemAnnouncementItem[]; unreadCount: number }> {
  await ensureVersionCatalog();

  const limit = query.limit;
  const [rows, reads] = await Promise.all([
    prisma.systemAnnouncement.findMany({
      where: activeWhere(),
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
    prisma.userAnnouncementRead.findMany({
      where: { userId },
      select: { announcementId: true },
    }),
  ]);

  const seen = new Set(reads.map((r) => r.announcementId));
  const items = rows.map((row) => toItem(row, seen));
  const unreadCount = items.filter((i) => !i.read).length;
  return { items, unreadCount };
}

/**
 * Marca un aviso como leído y devuelve el listado actualizado.
 */
export async function markAnnouncementRead(
  userId: string,
  announcementId: string,
): Promise<{ items: SystemAnnouncementItem[]; unreadCount: number }> {
  const exists = await prisma.systemAnnouncement.findFirst({
    where: { id: announcementId, ...activeWhere() },
    select: { id: true },
  });
  if (!exists) {
    throw new AppError(404, "announcement_not_found", "Aviso no encontrado");
  }

  await prisma.userAnnouncementRead.upsert({
    where: {
      userId_announcementId: { userId, announcementId },
    },
    create: { userId, announcementId },
    update: {},
  });

  return listAnnouncementsForUser(userId, { limit: 20 });
}

/**
 * Marca todos los avisos activos como leídos.
 */
export async function markAllAnnouncementsRead(
  userId: string,
): Promise<{ items: SystemAnnouncementItem[]; unreadCount: number }> {
  await ensureVersionCatalog();
  const rows = await prisma.systemAnnouncement.findMany({
    where: activeWhere(),
    select: { id: true },
  });

  if (rows.length) {
    await prisma.userAnnouncementRead.createMany({
      data: rows.map((row) => ({
        userId,
        announcementId: row.id,
      })),
      skipDuplicates: true,
    });
  }

  return listAnnouncementsForUser(userId, { limit: 20 });
}
