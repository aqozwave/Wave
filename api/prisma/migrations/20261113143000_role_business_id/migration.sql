-- Rol custom anclado a empresa; sistema sigue con business_id null.
ALTER TABLE "roles" ADD COLUMN "business_id" UUID;

-- FK a businesses (restrict: no borrar empresa con roles custom).
ALTER TABLE "roles" ADD CONSTRAINT "roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "roles_business_id_idx" ON "roles"("business_id");

-- Reemplaza unique global de key: sistema único en null; custom único por empresa (activos).
DROP INDEX "roles_key_key";

CREATE UNIQUE INDEX "roles_system_key_unique" ON "roles" ("key")
WHERE "business_id" IS NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "roles_business_key_unique" ON "roles" ("business_id", "key")
WHERE "business_id" IS NOT NULL AND "deleted_at" IS NULL;
