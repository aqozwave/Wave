-- Nombre único por empresa entre ubicaciones no borradas (criterio soft-unique del portal viejo).
-- lower(name) + business_id para no depender del casing.
CREATE UNIQUE INDEX "locations_business_name_active_key"
ON "locations" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;
