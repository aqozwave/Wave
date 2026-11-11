-- Nave de la sesión (contador Panel + filtro de embarcados).
-- Backfill desde el primer asistente si ya había borradores de prueba.

ALTER TABLE "training_sessions" ADD COLUMN "location_id" UUID;

UPDATE "training_sessions" AS ts
SET "location_id" = sub."location_id"
FROM (
  SELECT DISTINCT ON (tsa."session_id")
    tsa."session_id",
    cm."location_id"
  FROM "training_session_attendees" tsa
  INNER JOIN "crew_members" cm ON cm."id" = tsa."crew_member_id"
  ORDER BY tsa."session_id", tsa."created_at" ASC
) AS sub
WHERE ts."id" = sub."session_id"
  AND ts."location_id" IS NULL;

-- Sesiones sin asistentes (no deberían existir): se eliminan para poder poner NOT NULL.
DELETE FROM "training_sessions" WHERE "location_id" IS NULL;

ALTER TABLE "training_sessions" ALTER COLUMN "location_id" SET NOT NULL;

CREATE INDEX "training_sessions_location_id_idx" ON "training_sessions"("location_id");

ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
