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

/** Ítem admin (incluye vencimiento y soft-delete). */
export const systemAnnouncementAdminItemSchema = z
  .object({
    id: z.uuid(),
    kind: systemAnnouncementKindSchema,
    title: z.string(),
    body: z.string(),
    metadata: z.unknown().nullable(),
    publishedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    dedupeKey: z.string().nullable(),
    createdById: z.uuid().nullable(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("SystemAnnouncementAdminItem");

/** Query listado admin (incluye vencidos / borrados opcionales). */
export const listAdminSystemAnnouncementsQuerySchema = z.object({
  includeExpired: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const listAdminSystemAnnouncementsRequestSchema = z.object({
  query: listAdminSystemAnnouncementsQuerySchema,
});

export const listAdminSystemAnnouncementsResponseSchema = z
  .object({
    items: z.array(systemAnnouncementAdminItemSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi("ListAdminSystemAnnouncementsResponse");

/** Body POST admin — publicar aviso. */
export const createSystemAnnouncementBodySchema = z.object({
  kind: systemAnnouncementKindSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  /** ISO; default = ahora. */
  publishedAt: z.string().datetime().optional(),
  /** ISO o null = sin vencimiento. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export const createSystemAnnouncementRequestSchema = z.object({
  body: createSystemAnnouncementBodySchema,
});

export const createSystemAnnouncementResponseSchema =
  systemAnnouncementAdminItemSchema;

/** Body PATCH admin. */
export const updateSystemAnnouncementBodySchema = z
  .object({
    kind: systemAnnouncementKindSchema.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    body: z.string().trim().min(1).max(4000).optional(),
    publishedAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateSystemAnnouncementRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: updateSystemAnnouncementBodySchema,
});

export const updateSystemAnnouncementResponseSchema =
  systemAnnouncementAdminItemSchema;

export const deleteSystemAnnouncementRequestSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const deleteSystemAnnouncementResponseSchema =
  systemAnnouncementAdminItemSchema;

export type ListAdminSystemAnnouncementsQuery = z.infer<
  typeof listAdminSystemAnnouncementsQuerySchema
>;
export type CreateSystemAnnouncementBody = z.infer<
  typeof createSystemAnnouncementBodySchema
>;
export type UpdateSystemAnnouncementBody = z.infer<
  typeof updateSystemAnnouncementBodySchema
>;
export type SystemAnnouncementAdminItem = z.infer<
  typeof systemAnnouncementAdminItemSchema
>;
