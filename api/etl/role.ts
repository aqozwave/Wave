/**
 * ETL Role: seed de sistema + Mongo (colección roles) → Postgres.
 *
 * Uso:
 *   npm run etl:role           # dry-run
 *   npm run etl:role -- --apply
 *
 * 1) Upsert SYSTEM_ROLE_DEFS por key (isSystem).
 * 2) Lee Mongo roles: upsert por legacyMongoId / key.
 *    dataScope "external" (portal viejo) → "self" (Wave).
 * Solo lectura en Mongo.
 */

import { PrismaClient, type RoleDataScope } from "@prisma/client";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  ROLE_DATA_SCOPES,
  SYSTEM_ROLE_DEFS,
} from "../src/lib/permissions.js";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento Role en Mongo. */
type MongoRole = {
  _id: { toString(): string };
  key?: string | null;
  name?: string | null;
  description?: string | null;
  isSystem?: boolean | null;
  dataScope?: string | null;
  permissions?: Array<{ resource?: string; actions?: string[] }> | null;
  state?: boolean | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
};

/** ¿Hay flag --apply? */
function wantsApply(): boolean {
  return process.argv.includes("--apply");
}

/** Clave normalizada. */
function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

/**
 * Portal viejo usaba "external"; Wave Prisma usa "self".
 * area no existía en Mongo; si viene inválido → business.
 */
function mapDataScope(raw: string | null | undefined): RoleDataScope {
  if (raw === "external") return "self";
  if (raw && (ROLE_DATA_SCOPES as readonly string[]).includes(raw)) {
    return raw as RoleDataScope;
  }
  return "business";
}

/** Filtra permissions a recursos/acciones conocidos en Wave. */
function sanitizePermissions(
  raw: MongoRole["permissions"],
): Array<{ resource: string; actions: string[] }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ resource: string; actions: string[] }> = [];
  for (const row of raw) {
    if (!row?.resource) continue;
    if (!(PERMISSION_RESOURCES as readonly string[]).includes(row.resource)) {
      continue;
    }
    const actions = (row.actions ?? []).filter((a) =>
      (PERMISSION_ACTIONS as readonly string[]).includes(a),
    );
    if (actions.length === 0) continue;
    out.push({ resource: row.resource, actions });
  }
  return out;
}

async function main(): Promise<void> {
  const apply = wantsApply();
  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[etl:role] modo=${mode} db=${db.databaseName}`);

  try {
    // --- 1) Seed sistema ---
    let systemWritten = 0;
    for (const def of SYSTEM_ROLE_DEFS) {
      const existing = await prisma.role.findFirst({
        where: { key: def.key, deletedAt: null },
      });
      console.log(
        `[etl:role] sistema ${existing ? "update" : "create"} key=${def.key}`,
      );
      if (!apply) continue;

      const payload = {
        name: def.name,
        description: def.description,
        isSystem: true,
        dataScope: def.dataScope as RoleDataScope,
        permissions: def.permissions as object,
        state: true,
        deletedAt: null,
      };

      if (existing) {
        await prisma.role.update({ where: { id: existing.id }, data: payload });
      } else {
        await prisma.role.create({ data: { key: def.key, ...payload } });
      }
      systemWritten += 1;
    }

    // --- 2) Mongo → PG ---
    const docs = await db.collection<MongoRole>("roles").find({}).toArray();
    console.log(`[etl:role] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let mongoWritten = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const rawKey = doc.key?.trim();
      const rawName = doc.name?.trim();
      if (!rawKey && !rawName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin key ni name`);
        continue;
      }

      const key = normalizeKey(rawKey || rawName!);
      if (!key) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: key inválida`);
        continue;
      }

      const name = (rawName || key).trim();
      const dataScope = mapDataScope(doc.dataScope);
      const permissions = sanitizePermissions(doc.permissions);
      const payload = {
        name,
        description: (doc.description ?? "").trim(),
        isSystem: doc.isSystem ?? false,
        dataScope,
        permissions,
        state: doc.state ?? true,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.role.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.role.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        mongoWritten += 1;
        continue;
      }

      const byKey = await prisma.role.findFirst({
        where: { key, deletedAt: null },
      });
      if (byKey) {
        // Une legacy al rol ya sembrado por key (sistema).
        await prisma.role.update({
          where: { id: byKey.id },
          data: {
            ...payload,
            legacyMongoId,
            // Conserva isSystem del seed si ya era sistema.
            isSystem: byKey.isSystem || payload.isSystem,
          },
        });
        mongoWritten += 1;
        continue;
      }

      await prisma.role.create({
        data: {
          key,
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      mongoWritten += 1;
    }

    console.log(`[etl:role] mongo upsertables: ${wouldUpsert}`);
    console.log(`[etl:role] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const r of skipReasons.slice(0, 20)) console.log(`  - ${r}`);
    }

    if (apply) {
      console.log(`[etl:role] sistema escritos: ${systemWritten}`);
      console.log(`[etl:role] mongo escritos: ${mongoWritten}`);
      const total = await prisma.role.count({ where: { deletedAt: null } });
      console.log(`[etl:role] total roles activos: ${total}`);
    } else {
      console.log(
        "[etl:role] dry-run OK. Para escribir: npm run etl:role -- --apply",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:role] falló:", err);
  process.exit(1);
});
