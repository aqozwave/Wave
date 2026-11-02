/**
 * Inventario ETL + conteos Mongo vs Postgres (solo lectura).
 *
 * Uso:
 *   npm run etl:checksums
 *
 * No escribe en ninguna BD. Si pasás --apply, aborta (este script no aplica).
 * Sirve para el corte a producción (Sección 12): ver gaps y deltas por entidad.
 */

import { PrismaClient } from "@prisma/client";
import { connectMongoReadOnly } from "./lib/mongo.js";

/** Estado del ETL para una entidad del inventario. */
type EtlStatus = "ready" | "missing" | "wave_only";

/**
 * Fila del inventario: colección Mongo ↔ modelo Prisma ↔ npm script.
 * order = orden de dependencias FK (menor primero).
 */
type InventoryRow = {
  key: string;
  order: number;
  status: EtlStatus;
  mongoCollection: string | null;
  prismaModel: keyof PrismaClient;
  npmScript: string | null;
  note?: string;
};

/**
 * Inventario fijo de entidades Wave vs Mongo.
 * Las ready usan el mismo nombre de colección que cada etl/*.ts.
 */
const INVENTORY: InventoryRow[] = [
  {
    key: "business",
    order: 10,
    status: "ready",
    mongoCollection: "businesses",
    prismaModel: "business",
    npmScript: "etl:business",
  },
  {
    key: "location",
    order: 20,
    status: "ready",
    mongoCollection: "locations",
    prismaModel: "location",
    npmScript: "etl:location",
  },
  {
    key: "area",
    order: 30,
    status: "ready",
    mongoCollection: "areas",
    prismaModel: "area",
    npmScript: "etl:area",
  },
  {
    key: "rank",
    order: 40,
    status: "ready",
    mongoCollection: "ranks",
    prismaModel: "rank",
    npmScript: "etl:rank",
  },
  {
    key: "academicDegree",
    order: 41,
    status: "ready",
    mongoCollection: "academicdegrees",
    prismaModel: "academicDegree",
    npmScript: "etl:academic-degree",
  },
  {
    key: "competencyCertificate",
    order: 42,
    status: "ready",
    mongoCollection: "competencycertificates",
    prismaModel: "competencyCertificate",
    npmScript: "etl:competency-certificate",
  },
  {
    key: "course",
    order: 43,
    status: "ready",
    mongoCollection: "courses",
    prismaModel: "course",
    npmScript: "etl:course",
  },
  {
    key: "muelle",
    order: 44,
    status: "ready",
    mongoCollection: "muelles",
    prismaModel: "muelle",
    npmScript: "etl:muelle",
  },
  {
    key: "travesia",
    order: 45,
    status: "ready",
    mongoCollection: "travesias",
    prismaModel: "travesia",
    npmScript: "etl:travesia",
  },
  {
    key: "role",
    order: 50,
    status: "ready",
    mongoCollection: "roles",
    prismaModel: "role",
    npmScript: "etl:role",
  },
  {
    key: "user",
    order: 55,
    status: "missing",
    mongoCollection: "users",
    prismaModel: "user",
    npmScript: null,
    note: "ETL pendiente (Sección 12)",
  },
  {
    key: "documentType",
    order: 56,
    status: "missing",
    mongoCollection: "documenttypes",
    prismaModel: "documentType",
    npmScript: null,
    note: "Clon actual: colección vacía/inexistente; PG viene de seed Wave",
  },
  {
    key: "crewMember",
    order: 60,
    status: "ready",
    mongoCollection: "crewmembers",
    prismaModel: "crewMember",
    npmScript: "etl:crew-member",
  },
  {
    key: "crewMemberMuelle",
    order: 61,
    status: "ready",
    mongoCollection: "crewmembermuelles",
    prismaModel: "crewMemberMuelle",
    npmScript: "etl:crew-member-muelle",
  },
  {
    key: "crewMemberTravesia",
    order: 62,
    status: "ready",
    mongoCollection: "crewmembertravesias",
    prismaModel: "crewMemberTravesia",
    npmScript: "etl:crew-member-travesia",
  },
  {
    key: "competencyCertificateCourse",
    order: 63,
    status: "ready",
    mongoCollection: "competencycertificatecourses",
    prismaModel: "competencyCertificateCourse",
    npmScript: "etl:competency-certificate-course",
  },
  {
    key: "crewMemberCourse",
    order: 64,
    status: "ready",
    mongoCollection: "crewmembercourses",
    prismaModel: "crewMemberCourse",
    npmScript: "etl:crew-member-course",
  },
  {
    key: "crewMemberDocument",
    order: 65,
    status: "missing",
    mongoCollection: "crewmemberdocuments",
    prismaModel: "crewMemberDocument",
    npmScript: null,
    note: "Clon actual: sin colección; docs pueden vivir embebidos o en FS",
  },
  {
    key: "port",
    order: 70,
    status: "missing",
    mongoCollection: "ports",
    prismaModel: "port",
    npmScript: null,
    note: "Clon actual: sin colección; PG seed/manual",
  },
  {
    key: "activityLog",
    order: 80,
    status: "missing",
    mongoCollection: "activitylogs",
    prismaModel: "activityLog",
    npmScript: null,
    note: "Deuda S10",
  },
  {
    key: "systemAnnouncement",
    order: 81,
    status: "missing",
    mongoCollection: "systemannouncements",
    prismaModel: "systemAnnouncement",
    npmScript: null,
    note: "Deuda S10",
  },
  {
    key: "notificationOutbox",
    order: 82,
    status: "missing",
    mongoCollection: "notificationoutboxes",
    prismaModel: "notificationOutbox",
    npmScript: null,
    note: "Opcional; outbox Wave puede nacer vacío",
  },
  {
    key: "refreshToken",
    order: 90,
    status: "wave_only",
    mongoCollection: null,
    prismaModel: "refreshToken",
    npmScript: null,
    note: "Nativo Wave; no migrar",
  },
  {
    key: "loginChallenge",
    order: 91,
    status: "wave_only",
    mongoCollection: null,
    prismaModel: "loginChallenge",
    npmScript: null,
    note: "Nativo Wave / efímero; no migrar (Mongo: loginchallenges)",
  },
  {
    key: "emailToken",
    order: 92,
    status: "wave_only",
    mongoCollection: null,
    prismaModel: "emailToken",
    npmScript: null,
    note: "Nativo Wave; no migrar",
  },
  {
    key: "systemSetting",
    order: 93,
    status: "wave_only",
    mongoCollection: null,
    prismaModel: "systemSetting",
    npmScript: null,
    note: "Nativo Wave / seed",
  },
  {
    key: "userAnnouncementRead",
    order: 94,
    status: "wave_only",
    mongoCollection: null,
    prismaModel: "userAnnouncementRead",
    npmScript: null,
    note: "Nativo Wave; no migrar",
  },
];

/** Resultado de conteos para una fila ready o missing con colección. */
type CountRow = {
  key: string;
  status: EtlStatus;
  mongoCollection: string | null;
  mongoCount: number | null;
  pgTotal: number;
  pgWithLegacy: number;
  /** IDs Mongo presentes también en PG (sample overlap). */
  matchedLegacy: number | null;
  /** Mongo sin fila PG con ese legacy (aprox. faltan migrar). */
  mongoOnly: number | null;
  /** PG con legacy que no está en el sample Mongo (huérfanos / otra fuente). */
  pgOnlyLegacy: number | null;
  npmScript: string | null;
  note?: string;
  error?: string;
};

/** Delegate Prisma con count tipado a mínimos. */
type CountDelegate = {
  count: (args?: {
    where?: { legacyMongoId?: { not: null } };
  }) => Promise<number>;
  findMany: (args: {
    where: { legacyMongoId: { not: null } };
    select: { legacyMongoId: true };
  }) => Promise<Array<{ legacyMongoId: string | null }>>;
};

/** Obtiene el delegate Prisma por nombre de modelo. */
function getDelegate(
  prisma: PrismaClient,
  model: keyof PrismaClient,
): CountDelegate {
  const delegate = prisma[model] as unknown as CountDelegate;
  if (!delegate || typeof delegate.count !== "function") {
    throw new Error(`Prisma model no usable para count: ${String(model)}`);
  }
  return delegate;
}

/**
 * Compara IDs Mongo vs legacy en PG.
 * Para colecciones grandes no carga todo Mongo en memoria: usa count + sample
 * de hasta SAMPLE_CAP ids para estimar matched/mongoOnly.
 */
const SAMPLE_CAP = 50_000;

/**
 * Colecciones Mongo conocidas que no mapean 1:1 a un modelo Wave migrable.
 * Evitan ruido en el listado «sin mapear».
 */
const MONGO_SKIP_COLLECTIONS = new Set([
  "loginchallenges",
  "systemstates",
]);

async function main(): Promise<void> {
  if (process.argv.includes("--apply")) {
    console.error(
      "[etl:checksums] Este script es solo lectura. No uses --apply aquí.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const { client, db } = await connectMongoReadOnly();

  console.log(
    `[etl:checksums] db=${db.databaseName} (Mongo RO + Postgres RO counts)`,
  );
  console.log(
    `[etl:checksums] sample_cap=${SAMPLE_CAP} (matched/mongoOnly usan hasta ese tope de _id)`,
  );
  console.log("");

  const rows: CountRow[] = [];

  try {
    for (const item of INVENTORY) {
      const delegate = getDelegate(prisma, item.prismaModel);
      const pgTotal = await delegate.count();
      let pgWithLegacy = 0;
      try {
        pgWithLegacy = await delegate.count({
          where: { legacyMongoId: { not: null } },
        });
      } catch {
        // Modelos wave_only sin legacyMongoId en schema: count con where falla.
        pgWithLegacy = 0;
      }

      if (item.status === "wave_only" || !item.mongoCollection) {
        rows.push({
          key: item.key,
          status: item.status,
          mongoCollection: null,
          mongoCount: null,
          pgTotal,
          pgWithLegacy,
          matchedLegacy: null,
          mongoOnly: null,
          pgOnlyLegacy: null,
          npmScript: item.npmScript,
          note: item.note,
        });
        continue;
      }

      try {
        const col = db.collection(item.mongoCollection);
        const mongoCount = await col.countDocuments({});

        // Carga de _ids para cruzar con PG (tope SAMPLE_CAP).
        const mongoIds: string[] = [];
        const cursor = col.find({}, { projection: { _id: 1 } }).limit(SAMPLE_CAP);
        for await (const doc of cursor) {
          const id = doc._id?.toString?.() ?? String(doc._id);
          mongoIds.push(id);
        }
        const mongoIdSet = new Set(mongoIds);
        const sampledAll = mongoIds.length >= mongoCount;

        const pgLegacyRows = await delegate.findMany({
          where: { legacyMongoId: { not: null } },
          select: { legacyMongoId: true },
        });
        const pgLegacySet = new Set(
          pgLegacyRows
            .map((r) => r.legacyMongoId)
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        );

        let matched = 0;
        for (const id of mongoIdSet) {
          if (pgLegacySet.has(id)) matched += 1;
        }
        const mongoOnly = mongoIdSet.size - matched;

        let pgOnly = 0;
        for (const id of pgLegacySet) {
          if (!mongoIdSet.has(id)) pgOnly += 1;
        }
        // Si no muestreámos todo Mongo, pgOnly sobreestima (ids fuera del sample).
        if (!sampledAll) {
          pgOnly = -1;
        }

        rows.push({
          key: item.key,
          status: item.status,
          mongoCollection: item.mongoCollection,
          mongoCount,
          pgTotal,
          pgWithLegacy,
          matchedLegacy: matched,
          mongoOnly,
          pgOnlyLegacy: pgOnly < 0 ? null : pgOnly,
          npmScript: item.npmScript,
          note:
            item.note ??
            (!sampledAll
              ? `sample ${mongoIds.length}/${mongoCount}; pgOnly no calculado`
              : undefined),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rows.push({
          key: item.key,
          status: item.status,
          mongoCollection: item.mongoCollection,
          mongoCount: null,
          pgTotal,
          pgWithLegacy,
          matchedLegacy: null,
          mongoOnly: null,
          pgOnlyLegacy: null,
          npmScript: item.npmScript,
          note: item.note,
          error: message,
        });
      }
    }

    // Colecciones presentes en Mongo y no listadas en el inventario.
    const known = new Set(
      INVENTORY.map((i) => i.mongoCollection).filter(
        (c): c is string => typeof c === "string",
      ),
    );
    for (const skip of MONGO_SKIP_COLLECTIONS) known.add(skip);
    const mongoNames = (await db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith("system."))
      .sort();
    const unmapped = mongoNames.filter((n) => !known.has(n));
    console.log(
      `[etl:checksums] colecciones Mongo totales=${mongoNames.length} sin mapear=${unmapped.length}`,
    );
    if (unmapped.length > 0) {
      console.log(`[etl:checksums] sin mapear: ${unmapped.join(", ")}`);
    }
    console.log("");
  } finally {
    await client.close();
    await prisma.$disconnect();
  }

  // Tabla resumen.
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  const num = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : String(v);

  console.log(
    [
      pad("key", 28),
      pad("status", 10),
      pad("mongo", 8),
      pad("pg", 8),
      pad("pgLegacy", 8),
      pad("matched", 8),
      pad("mongoOnly", 9),
      pad("pgOnly", 7),
      "script/note",
    ].join(" "),
  );
  console.log("-".repeat(120));

  for (const r of rows) {
    const tail = r.error
      ? `ERROR: ${r.error}`
      : [r.npmScript ?? "", r.note ?? ""].filter(Boolean).join(" · ");
    console.log(
      [
        pad(r.key, 28),
        pad(r.status, 10),
        pad(num(r.mongoCount), 8),
        pad(num(r.pgTotal), 8),
        pad(num(r.pgWithLegacy), 8),
        pad(num(r.matchedLegacy), 8),
        pad(num(r.mongoOnly), 9),
        pad(num(r.pgOnlyLegacy), 7),
        tail,
      ].join(" "),
    );
  }

  const missing = rows.filter((r) => r.status === "missing");
  const readyGaps = rows.filter(
    (r) =>
      r.status === "ready" &&
      r.mongoOnly !== null &&
      r.mongoOnly > 0,
  );

  console.log("");
  console.log(
    `[etl:checksums] ready=${rows.filter((r) => r.status === "ready").length} missing_etl=${missing.length} wave_only=${rows.filter((r) => r.status === "wave_only").length}`,
  );
  if (missing.length > 0) {
    console.log(
      `[etl:checksums] ETL faltantes: ${missing.map((m) => m.key).join(", ")}`,
    );
  }
  if (readyGaps.length > 0) {
    console.log(
      `[etl:checksums] ready con mongoOnly>0 (faltan migrar o skips): ${readyGaps
        .map((g) => `${g.key}=${g.mongoOnly}`)
        .join(", ")}`,
    );
  } else {
    console.log(
      "[etl:checksums] ready: sin mongoOnly detectado en el sample (OK o BD vacía).",
    );
  }
}

main().catch((err) => {
  console.error("[etl:checksums] falló:", err);
  process.exit(1);
});
