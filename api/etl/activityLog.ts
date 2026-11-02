/**
 * ETL ActivityLog: Mongo (activitylogs) → Postgres (activity_logs).
 *
 * Uso:
 *   npm run etl:activity-log           # dry-run
 *   npm run etl:activity-log -- --apply
 *
 * Idempotente: upsert por legacyMongoId.
 * actorId se resuelve por users.legacyMongoId; si no hay match → null
 * (quedan actorUsername/email/role del snapshot).
 * resourceId se guarda como string del ObjectId Mongo (no se remapea a uuid).
 * Solo lectura en Mongo.
 */

import {
  PrismaClient,
  type ActivityAction,
  type ActivityResource,
} from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Acciones válidas en Wave (enum Prisma). */
const ACTIONS = new Set<string>([
  "LOGIN",
  "LOGOUT",
  "REGISTER",
  "CREATE",
  "UPDATE",
  "DELETE",
]);

/** Recursos válidos en Wave (enum Prisma). */
const RESOURCES = new Set<string>([
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
  "system",
]);

/** Documento ActivityLog en Mongo. */
type MongoActivityLog = {
  _id: { toString(): string };
  action?: string | null;
  resource?: string | null;
  resourceId?: { toString(): string } | string | null;
  actorId?: { toString(): string } | string | null;
  actorUsername?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetLabel?: string | null;
  success?: boolean | null;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  createdAt?: Date | null;
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
  console.log(`[etl:activity-log] modo=${mode} db=${db.databaseName}`);

  try {
    const users = await prisma.user.findMany({
      where: { legacyMongoId: { not: null } },
      select: { id: true, legacyMongoId: true },
    });
    const userByLegacy = new Map<string, string>();
    for (const u of users) {
      if (u.legacyMongoId) userByLegacy.set(u.legacyMongoId, u.id);
    }
    console.log(
      `[etl:activity-log] users con legacy en PG: ${userByLegacy.size}`,
    );

    const docs = await db
      .collection<MongoActivityLog>("activitylogs")
      .find({})
      .toArray();
    console.log(`[etl:activity-log] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    let actorUnresolved = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const actionRaw = emptyToNull(doc.action);
      const resourceRaw = emptyToNull(doc.resource);

      if (!actionRaw || !ACTIONS.has(actionRaw)) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: action inválida (${actionRaw})`);
        continue;
      }
      if (!resourceRaw || !RESOURCES.has(resourceRaw)) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: resource inválido (${resourceRaw})`,
        );
        continue;
      }

      const mongoActorId = idToString(doc.actorId);
      let actorId: string | null = null;
      if (mongoActorId) {
        actorId = userByLegacy.get(mongoActorId) ?? null;
        if (!actorId) actorUnresolved += 1;
      }

      const metadata =
        doc.metadata === undefined || doc.metadata === null
          ? null
          : (doc.metadata as object);

      const payload = {
        action: actionRaw as ActivityAction,
        resource: resourceRaw as ActivityResource,
        resourceId: idToString(doc.resourceId),
        actorId,
        actorUsername: emptyToNull(doc.actorUsername),
        actorEmail: emptyToNull(doc.actorEmail)?.toLowerCase() ?? null,
        actorRole: emptyToNull(doc.actorRole),
        targetLabel: emptyToNull(doc.targetLabel),
        success: doc.success ?? true,
        errorMessage: emptyToNull(doc.errorMessage),
        ip: emptyToNull(doc.ip),
        userAgent: emptyToNull(doc.userAgent),
        metadata,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.activityLog.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.activityLog.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      await prisma.activityLog.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:activity-log] upsertables: ${wouldUpsert}`);
    console.log(`[etl:activity-log] omitidos: ${skipped}`);
    console.log(
      `[etl:activity-log] actorId sin resolver (quedó null): ${actorUnresolved}`,
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
      console.log(`[etl:activity-log] escritos: ${written}`);
      const total = await prisma.activityLog.count();
      const withLegacy = await prisma.activityLog.count({
        where: { legacyMongoId: { not: null } },
      });
      console.log(
        `[etl:activity-log] total PG=${total} con legacy=${withLegacy}`,
      );
    } else {
      console.log(
        "[etl:activity-log] dry-run OK. Para escribir: npm run etl:activity-log -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:activity-log] falló:", err);
  process.exit(1);
});
