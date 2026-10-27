-- CreateTable
CREATE TABLE "academic_degrees" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "academic_degrees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_degrees_legacy_mongo_id_key" ON "academic_degrees"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "academic_degrees_business_id_idx" ON "academic_degrees"("business_id");

-- CreateIndex
CREATE INDEX "academic_degrees_name_business_id_idx" ON "academic_degrees"("name", "business_id");

-- AddForeignKey
ALTER TABLE "academic_degrees" ADD CONSTRAINT "academic_degrees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre títulos no borrados (portal viejo; lower para casing).
CREATE UNIQUE INDEX "academic_degrees_business_name_active_key"
ON "academic_degrees" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;
