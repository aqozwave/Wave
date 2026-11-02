import type { Request } from "express";
import type { ActivityAction, ActivityResource, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { clientIp } from "../../lib/rateLimit.js";
import type {
  ActivityLogItem,
  ListActivityLogsQuery,
} from "./activityLogs.schemas.js";

/** Snapshot del actor (perfil en el momento del evento). */
export type ActivityActor = {
  actorId: string | null;
  actorUsername: string | null;
  actorEmail: string | null;
  actorRole: string | null;
};

/** Entrada de recordActivity (fire-and-forget). */
export type RecordActivityInput = {
  req?: Request;
  actor?: ActivityActor | null;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId?: string | null;
  targetLabel?: string | null;
  success?: boolean;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

/**
 * Arma el snapshot del actor desde el perfil AuthUser / fila User.
 */
export function actorFromProfile(
  profile:
    | {
        id?: string;
        username?: string | null;
        email?: string | null;
        internalRol?: string | null;
      }
    | null
    | undefined,
): ActivityActor | null {
  if (!profile?.id) return null;
  return {
    actorId: profile.id,
    actorUsername: profile.username ?? null,
    actorEmail: profile.email ?? null,
    actorRole: profile.internalRol ?? null,
  };
}

/** User-Agent del request (recortado). */
function readUserAgent(req: Request | undefined): string | null {
  if (!req) return null;
  const raw = req.headers["user-agent"];
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().slice(0, 500);
}

/**
 * Persiste un evento de auditoría sin bloquear la petición.
 * Si el insert falla, solo loguea en consola (no rompe el flujo).
 */
export function recordActivity(input: RecordActivityInput): void {
  const {
    req,
    actor = null,
    action,
    resource,
    resourceId = null,
    targetLabel = null,
    success = true,
    errorMessage = null,
    metadata = null,
  } = input;

  void prisma.activityLog
    .create({
      data: {
        action,
        resource,
        resourceId,
        actorId: actor?.actorId ?? null,
        actorUsername: actor?.actorUsername ?? null,
        actorEmail: actor?.actorEmail ?? null,
        actorRole: actor?.actorRole ?? null,
        targetLabel,
        success,
        errorMessage,
        ip: req ? clientIp(req) : null,
        userAgent: readUserAgent(req),
        metadata: metadata ?? undefined,
      },
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[activity] no se pudo persistir", {
        message,
        action,
        resource,
      });
    });
}

/** Mapea fila Prisma → contrato API. */
function toItem(row: {
  id: string;
  action: ActivityAction;
  resource: ActivityResource;
  resourceId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetLabel: string | null;
  success: boolean;
  errorMessage: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): ActivityLogItem {
  return {
    id: row.id,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId,
    actorId: row.actorId,
    actorUsername: row.actorUsername,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    targetLabel: row.targetLabel,
    success: row.success,
    errorMessage: row.errorMessage,
    ip: row.ip,
    userAgent: row.userAgent,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Listado paginado de auditoría (solo superadmin en la ruta).
 */
export async function listActivityLogs(query: ListActivityLogsQuery): Promise<{
  items: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.ActivityLogWhereInput = {};
  if (query.action) where.action = query.action;
  if (query.resource) where.resource = query.resource;
  if (query.success === "true") where.success = true;
  if (query.success === "false") where.success = false;

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(toItem),
    total,
    page,
    limit,
  };
}
