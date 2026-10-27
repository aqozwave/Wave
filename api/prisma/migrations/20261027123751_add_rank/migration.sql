-- CreateTable
CREATE TABLE "ranks" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ranks_legacy_mongo_id_key" ON "ranks"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "ranks_business_id_idx" ON "ranks"("business_id");

-- CreateIndex
CREATE INDEX "ranks_name_business_id_idx" ON "ranks"("name", "business_id");

-- AddForeignKey
ALTER TABLE "ranks" ADD CONSTRAINT "ranks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre rangos no borrados (portal viejo; lower para casing).
CREATE UNIQUE INDEX "ranks_business_name_active_key"
ON "ranks" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;
