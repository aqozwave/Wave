import { z } from "../../lib/zod.js";

/** Tipos de aviso (mismo enum Prisma). */
export const systemAnnouncementKindSchema = z.enum([
  "version",
  "maintenance",
  "config",
]);

/** Query GET /system-announcements. */
export const listSystemAnnouncementsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const listSystemAnnouncementsRequestSchema = z.object({
  query: listSystemAnnouncementsQuerySchema,
});

/** Ítem con flag leído para la campanita. */
export const systemAnnouncementItemSchema = z
  .object({
    id: z.uuid(),
    kind: systemAnnouncementKindSchema,
    title: z.string(),
    body: z.string(),
    metadata: z.unknown().nullable(),
    publishedAt: z.string().datetime(),
    read: z.boolean(),
  })
  .openapi("SystemAnnouncementItem");

export const listSystemAnnouncementsResponseSchema = z
  .object({
    items: z.array(systemAnnouncementItemSchema),
    unreadCount: z.number().int().nonnegative(),
  })
  .openapi("ListSystemAnnouncementsResponse");

export const markSystemAnnouncementReadRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const markAllSystemAnnouncementsReadRequestSchema = z.object({});

export type ListSystemAnnouncementsQuery = z.infer<
  typeof listSystemAnnouncementsQuerySchema
>;
export type SystemAnnouncementItem = z.infer<
  typeof systemAnnouncementItemSchema
>;
