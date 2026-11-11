-- Área solicitante en avisos: copia de User.areaId al crear.
-- Backfill desde el creador; filas sin área quedan borradas (soft) si no se puede resolver.

-- AlterTable: columna nullable primero (puede haber filas).
ALTER TABLE "work_notices" ADD COLUMN "requesting_area_id" UUID;

-- Backfill desde el área del usuario creador.
UPDATE "work_notices" AS wn
SET "requesting_area_id" = u."area_id"
FROM "users" AS u
WHERE wn."created_by_id" = u."id"
  AND wn."requesting_area_id" IS NULL
  AND u."area_id" IS NOT NULL;

-- Soft-delete avisos que no se pudieron resolver (sin creador o sin área).
UPDATE "work_notices"
SET "deleted_at" = COALESCE("deleted_at", NOW())
WHERE "requesting_area_id" IS NULL
  AND "deleted_at" IS NULL;

-- Si aún quedan filas soft-deleted sin área, poner un placeholder no aplica:
-- exigir NOT NULL solo en filas activas no es posible con constraint simple.
-- Borrar físicamente las que sigan null (ya soft-deleted o basura).
DELETE FROM "work_notices" WHERE "requesting_area_id" IS NULL;

-- Ahora sí NOT NULL.
ALTER TABLE "work_notices" ALTER COLUMN "requesting_area_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "work_notices_requesting_area_id_idx" ON "work_notices"("requesting_area_id");

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_requesting_area_id_fkey" FOREIGN KEY ("requesting_area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
