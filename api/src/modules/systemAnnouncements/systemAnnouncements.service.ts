import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { VERSION_ANNOUNCEMENT_CATALOG } from "./systemAnnouncements.catalog.js";
import type {
  CreateSystemAnnouncementBody,
  ListAdminSystemAnnouncementsQuery,
  ListSystemAnnouncementsQuery,
  SystemAnnouncementAdminItem,
  SystemAnnouncementItem,
  UpdateSystemAnnouncementBody,
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

/** Serializa fila admin → contrato Zod. */
function toAdminItem(row: {
  id: string;
  kind: SystemAnnouncementAdminItem["kind"];
  title: string;
  body: string;
  metadata: Prisma.JsonValue | null;
  publishedAt: Date;
  expiresAt: Date | null;
  dedupeKey: string | null;
  createdById: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SystemAnnouncementAdminItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    metadata: row.metadata,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    dedupeKey: row.dedupeKey,
    createdById: row.createdById,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Listado admin (superadmin): no filtra por “activo” salvo flags.
 */
export async function listAnnouncementsAdmin(
  query: ListAdminSystemAnnouncementsQuery,
): Promise<{ items: SystemAnnouncementAdminItem[]; total: number }> {
  const now = new Date();
  const where: Prisma.SystemAnnouncementWhereInput = {};
  if (!query.includeDeleted) {
    where.deletedAt = null;
  }
  if (!query.includeExpired) {
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
  }

  const [total, rows] = await Promise.all([
    prisma.systemAnnouncement.count({ where }),
    prisma.systemAnnouncement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: query.limit,
    }),
  ]);

  return { items: rows.map(toAdminItem), total };
}

/** Publica un aviso de sistema (superadmin). */
export async function createAnnouncement(
  actorId: string,
  body: CreateSystemAnnouncementBody,
): Promise<SystemAnnouncementAdminItem> {
  const row = await prisma.systemAnnouncement.create({
    data: {
      kind: body.kind,
      title: body.title,
      body: body.body,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      expiresAt:
        body.expiresAt === undefined || body.expiresAt === null
          ? null
          : new Date(body.expiresAt),
      createdById: actorId,
    },
  });
  return toAdminItem(row);
}

/** Actualiza un aviso no borrado. */
export async function updateAnnouncement(
  id: string,
  body: UpdateSystemAnnouncementBody,
): Promise<SystemAnnouncementAdminItem> {
  const existing = await prisma.systemAnnouncement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "announcement_not_found", "Aviso no encontrado");
  }

  const row = await prisma.systemAnnouncement.update({
    where: { id },
    data: {
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.publishedAt !== undefined
        ? { publishedAt: new Date(body.publishedAt) }
        : {}),
      ...(body.expiresAt !== undefined
        ? {
            expiresAt:
              body.expiresAt === null ? null : new Date(body.expiresAt),
          }
        : {}),
    },
  });
  return toAdminItem(row);
}

/** Soft-delete de un aviso. */
export async function deleteAnnouncement(
  id: string,
): Promise<SystemAnnouncementAdminItem> {
  const existing = await prisma.systemAnnouncement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "announcement_not_found", "Aviso no encontrado");
  }

  const row = await prisma.systemAnnouncement.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return toAdminItem(row);
}
