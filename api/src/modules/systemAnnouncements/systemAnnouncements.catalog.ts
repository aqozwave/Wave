import type { SystemAnnouncementKind } from "@prisma/client";

/** Entrada del catálogo de avisos de versión (upsert por dedupeKey). */
export type VersionAnnouncementSeed = {
  dedupeKey: string;
  kind: SystemAnnouncementKind;
  title: string;
  body: string;
  publishedAt: string;
};

/**
 * Avisos de versión fijados en código.
 * Se upsertan al listar para que aparezcan tras un deploy.
 */
export const VERSION_ANNOUNCEMENT_CATALOG: VersionAnnouncementSeed[] = [
  {
    dedupeKey: "version:wave-2.0.0",
    kind: "version",
    title: "Portal Nachipa Wellboats (Wave)",
    body: "Nueva plataforma: autenticación endurecida, tripulantes, cursos OMI, vencimientos y registro de actividad. El portal anterior queda como referencia mientras migramos datos.",
    publishedAt: "2026-11-02T12:00:00.000Z",
  },
];
