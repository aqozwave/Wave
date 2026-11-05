import { z } from "../../lib/zod.js";

/** Acciones de auditoría (mismo enum Prisma). */
export const activityActionSchema = z.enum([
  "LOGIN",
  "LOGOUT",
  "REGISTER",
  "CREATE",
  "UPDATE",
  "DELETE",
]);

/** Recursos auditables (mismo enum Prisma). */
export const activityResourceSchema = z.enum([
  "auth",
  "user",
  "business",
  "location",
  "crewMember",
  "crewMemberCourse",
  "area",
  "rank",
  "academicDegree",
  "competencyCertificate",
  "documentType",
  "muelle",
  "travesia",
  "port",
  "course",
  "role",
  "permitType",
  "training",
  "contractorOrganization",
  "system",
]);

/** Query GET /activity-logs. */
export const listActivityLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
  action: activityActionSchema.optional(),
  resource: activityResourceSchema.optional(),
  /** true | false como string de query (se interpreta en el service). */
  success: z.enum(["true", "false"]).optional(),
});

export const listActivityLogsRequestSchema = z.object({
  query: listActivityLogsQuerySchema,
});

/** Fila de auditoría para la UI. */
export const activityLogItemSchema = z
  .object({
    id: z.uuid(),
    action: activityActionSchema,
    resource: activityResourceSchema,
    resourceId: z.string().nullable(),
    actorId: z.uuid().nullable(),
    actorUsername: z.string().nullable(),
    actorEmail: z.string().nullable(),
    actorRole: z.string().nullable(),
    targetLabel: z.string().nullable(),
    success: z.boolean(),
    errorMessage: z.string().nullable(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("ActivityLogItem");

export const listActivityLogsResponseSchema = z
  .object({
    items: z.array(activityLogItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi("ListActivityLogsResponse");

export type ListActivityLogsQuery = z.infer<typeof listActivityLogsQuerySchema>;
export type ActivityLogItem = z.infer<typeof activityLogItemSchema>;
export type ActivityAction = z.infer<typeof activityActionSchema>;
export type ActivityResource = z.infer<typeof activityResourceSchema>;
