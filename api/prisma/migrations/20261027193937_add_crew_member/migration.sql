-- RUN único por empresa entre tripulantes no borrados (portal viejo; lower para casing).
CREATE UNIQUE INDEX "crew_members_business_run_active_key"
ON "crew_members" ("business_id", lower("run"))
WHERE "deleted_at" IS NULL;

-- Email único por empresa entre tripulantes no borrados.
CREATE UNIQUE INDEX "crew_members_business_email_active_key"
ON "crew_members" ("business_id", lower("email"))
WHERE "deleted_at" IS NULL;
