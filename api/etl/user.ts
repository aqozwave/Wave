/**
 * ETL User: Mongo (colección users) → Postgres (tabla users).
 *
 * Uso:
 *   npm run etl:user           # dry-run (no escribe)
 *   npm run etl:user -- --apply
 *
 * Idempotente: upsert por legacyMongoId; si no, une por email (seed vs Mongo).
 * Copia el hash bcrypt de Mongo tal cual a passwordHash (login Wave debe
 * aceptar bcrypt + argon2; ver src/lib/password.ts).
 * Resuelve role / business / location / area por legacyMongoId.
 * Solo lectura en Mongo.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Documento User en Mongo (portal viejo). password = bcrypt. */
type MongoUser = {
  _id: { toString(): string };
  run?: string | null;
  username?: string | null;
  password?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  pendingEmail?: string | null;
  photoProfile?: string | null;
  internalRol?: string | null;
  roleID?: { toString(): string } | string | null;
  businessID?: { toString(): string } | string | null;
  locationID?: { toString(): string } | string | null;
  areaID?: { toString(): string } | string | null;
  state?: boolean | null;
  confirmed?: boolean | null;
  tokenVersion?: number | null;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  loginAttempts?: number | null;
  lockUntil?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** Roles internos conocidos del portal viejo (Wave guarda string libre). */
const KNOWN_INTERNAL_ROLES = new Set([
  "superadmin",
  "admin",
  "user",
  "colaborador",
  "contratista",
]);

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

/** ¿Hay flag --apply en argv? */
function wantsApply(): boolean {
  return process.argv.includes("--apply");
}

/** Carga mapa legacyMongoId → uuid Postgres. */
async function loadLegacyMap(
  prisma: PrismaClient,
  model: "role" | "business" | "location" | "area",
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
  console.log(`[etl:user] modo=${mode} db=${db.databaseName}`);

  try {
    const roleByLegacy = await loadLegacyMap(prisma, "role");
    const businessByLegacy = await loadLegacyMap(prisma, "business");
    const locationByLegacy = await loadLegacyMap(prisma, "location");
    const areaByLegacy = await loadLegacyMap(prisma, "area");

    // Fallback superadmin de sistema (seed) si el role Mongo no está linkeado.
    const systemSuperadmin = await prisma.role.findFirst({
      where: { key: "superadmin", deletedAt: null },
      select: { id: true },
    });

    console.log(
      `[etl:user] maps PG: role=${roleByLegacy.size} biz=${businessByLegacy.size} loc=${locationByLegacy.size} area=${areaByLegacy.size}`,
    );

    const col = db.collection<MongoUser>("users");
    // password tiene select:false en Mongoose; el driver crudo sí lo trae.
    const docs = await col.find({}).toArray();
    console.log(`[etl:user] documentos Mongo: ${docs.length}`);

    let wouldUpsert = 0;
    let skipped = 0;
    let written = 0;
    let mergedByEmail = 0;
    const skipReasons: string[] = [];

    for (const doc of docs) {
      const legacyMongoId = doc._id.toString();
      const run = emptyToNull(doc.run);
      const username = emptyToNull(doc.username)?.toLowerCase() ?? null;
      const email = emptyToNull(doc.email)?.toLowerCase() ?? null;
      const firstName = emptyToNull(doc.firstName)?.toLowerCase() ?? null;
      const lastName = emptyToNull(doc.lastName)?.toLowerCase() ?? null;
      const passwordHash = emptyToNull(doc.password);

      if (!run) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin run`);
        continue;
      }
      if (!username || username.length < 3) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin username válido`);
        continue;
      }
      if (!email) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin email`);
        continue;
      }
      if (!firstName || !lastName) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin firstName/lastName`);
        continue;
      }
      if (!passwordHash) {
        skipped += 1;
        skipReasons.push(`${legacyMongoId}: sin password`);
        continue;
      }

      const rawRol = (doc.internalRol ?? "user").trim().toLowerCase();
      const internalRol = KNOWN_INTERNAL_ROLES.has(rawRol) ? rawRol : "user";

      const mongoRoleId = idToString(doc.roleID);
      let roleId: string | null = mongoRoleId
        ? (roleByLegacy.get(mongoRoleId) ?? null)
        : null;
      if (!roleId && internalRol === "superadmin" && systemSuperadmin) {
        roleId = systemSuperadmin.id;
      }

      const mongoBusinessId = idToString(doc.businessID);
      const businessId = mongoBusinessId
        ? (businessByLegacy.get(mongoBusinessId) ?? null)
        : null;
      const mongoLocationId = idToString(doc.locationID);
      const locationId = mongoLocationId
        ? (locationByLegacy.get(mongoLocationId) ?? null)
        : null;
      const mongoAreaId = idToString(doc.areaID);
      const areaId = mongoAreaId
        ? (areaByLegacy.get(mongoAreaId) ?? null)
        : null;

      // Tenant: no-superadmin sin empresa resuelta → omitir (FK rota).
      if (internalRol !== "superadmin" && !businessId) {
        skipped += 1;
        skipReasons.push(
          `${legacyMongoId}: businessID ${mongoBusinessId ?? "null"} no está en Postgres (corré etl:business)`,
        );
        continue;
      }

      const payload = {
        run,
        username,
        passwordHash,
        firstName,
        lastName,
        email,
        pendingEmail: emptyToNull(doc.pendingEmail)?.toLowerCase() ?? null,
        photoProfile: emptyToNull(doc.photoProfile),
        internalRol,
        roleId,
        businessId,
        locationId,
        areaId,
        state: doc.state ?? true,
        confirmed: doc.confirmed ?? false,
        tokenVersion: doc.tokenVersion ?? 0,
        lastLoginAt: doc.lastLoginAt ?? null,
        lastLoginIp: emptyToNull(doc.lastLoginIp),
        loginAttempts: doc.loginAttempts ?? 0,
        lockUntil: doc.lockUntil ?? null,
        deletedAt: doc.deletedAt ?? null,
      };

      wouldUpsert += 1;
      if (!apply) continue;

      const byLegacy = await prisma.user.findUnique({
        where: { legacyMongoId },
      });
      if (byLegacy) {
        await prisma.user.update({
          where: { id: byLegacy.id },
          data: payload,
        });
        written += 1;
        continue;
      }

      // Une seed / usuarios creados a mano con el mismo email.
      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (byEmail) {
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { ...payload, legacyMongoId },
        });
        mergedByEmail += 1;
        written += 1;
        continue;
      }

      await prisma.user.create({
        data: {
          legacyMongoId,
          ...payload,
          ...(doc.createdAt ? { createdAt: doc.createdAt } : {}),
        },
      });
      written += 1;
    }

    console.log(`[etl:user] upsertables: ${wouldUpsert}`);
    console.log(`[etl:user] omitidos: ${skipped}`);
    if (skipReasons.length > 0) {
      for (const reason of skipReasons.slice(0, 30)) {
        console.log(`  - ${reason}`);
      }
      if (skipReasons.length > 30) {
        console.log(`  … y ${skipReasons.length - 30} más`);
      }
    }

    if (apply) {
      console.log(`[etl:user] escritos (upsert): ${written}`);
      console.log(`[etl:user] unidos por email: ${mergedByEmail}`);
      const totalPg = await prisma.user.count();
      const withLegacy = await prisma.user.count({
        where: { legacyMongoId: { not: null } },
      });
      console.log(
        `[etl:user] total Postgres users=${totalPg} con legacy=${withLegacy}`,
      );
    } else {
      console.log(
        "[etl:user] dry-run OK. Para escribir: npm run etl:user -- --apply",
      );
      console.log(
        "[etl:user] nota: login con hashes bcrypt requiere verify dual (bcryptjs); pedí OK antes de instalar.",
      );
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[etl:user] falló:", err);
  process.exit(1);
});
