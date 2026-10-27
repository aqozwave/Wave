-- Catálogo de puertos por empresa.
CREATE TABLE "ports" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ports_legacy_mongo_id_key" ON "ports"("legacy_mongo_id");
CREATE INDEX "ports_business_id_idx" ON "ports"("business_id");
CREATE INDEX "ports_name_business_id_idx" ON "ports"("name", "business_id");

ALTER TABLE "ports" ADD CONSTRAINT "ports_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre puertos no borrados.
CREATE UNIQUE INDEX "ports_business_name_active_key"
ON "ports" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;

-- Sembrar puertos desde port_name distintos ya usados en muelles.
INSERT INTO "ports" ("id", "name", "business_id", "state", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  src.port_name,
  src.business_id,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (m."business_id", lower(m."port_name"))
    m."business_id",
    m."port_name"
  FROM "muelles" m
  WHERE m."port_name" IS NOT NULL AND trim(m."port_name") <> ''
  ORDER BY m."business_id", lower(m."port_name"), m."created_at" ASC
) AS src;

-- FK nullable primero; backfill; luego NOT NULL.
ALTER TABLE "muelles" ADD COLUMN "port_id" UUID;

UPDATE "muelles" m
SET "port_id" = p."id"
FROM "ports" p
WHERE p."business_id" = m."business_id"
  AND lower(p."name") = lower(m."port_name")
  AND p."deleted_at" IS NULL;

-- Seguridad: no debería quedar ninguna fila sin puerto.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "muelles" WHERE "port_id" IS NULL) THEN
    RAISE EXCEPTION 'Hay muelles sin port_id tras el backfill';
  END IF;
END $$;

ALTER TABLE "muelles" ALTER COLUMN "port_id" SET NOT NULL;

-- Quitar índices / columna viejos de port_name.
DROP INDEX IF EXISTS "muelles_port_name_idx";
DROP INDEX IF EXISTS "muelles_name_port_name_business_id_idx";
DROP INDEX IF EXISTS "muelles_business_port_name_active_key";

ALTER TABLE "muelles" DROP COLUMN "port_name";

CREATE INDEX "muelles_port_id_idx" ON "muelles"("port_id");
CREATE INDEX "muelles_name_port_id_business_id_idx" ON "muelles"("name", "port_id", "business_id");

ALTER TABLE "muelles" ADD CONSTRAINT "muelles_port_id_fkey"
FOREIGN KEY ("port_id") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por puerto + empresa entre muelles no borrados.
CREATE UNIQUE INDEX "muelles_business_port_name_active_key"
ON "muelles" ("business_id", "port_id", lower("name"))
WHERE "deleted_at" IS NULL;
