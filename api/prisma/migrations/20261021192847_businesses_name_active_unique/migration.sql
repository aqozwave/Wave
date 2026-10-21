-- Nombre único entre empresas no borradas (mismo criterio soft-unique del portal viejo).
-- lower(name) para no depender del casing al insertar.
CREATE UNIQUE INDEX "businesses_name_active_key"
ON "businesses" (lower("name"))
WHERE "deleted_at" IS NULL;
