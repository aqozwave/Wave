-- Tope absoluto de sesión: no se renueva al rotar el refresh.
ALTER TABLE "refresh_tokens" ADD COLUMN "absolute_expires_at" TIMESTAMPTZ;

-- Filas existentes: 5 días desde created_at (mismo default de producto).
UPDATE "refresh_tokens"
SET "absolute_expires_at" = "created_at" + INTERVAL '5 days'
WHERE "absolute_expires_at" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "absolute_expires_at" SET NOT NULL;
