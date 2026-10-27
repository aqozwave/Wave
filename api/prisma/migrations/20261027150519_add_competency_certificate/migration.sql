-- CreateEnum
CREATE TYPE "OfficerKind" AS ENUM ('captain', 'first_pilot');

-- CreateTable
CREATE TABLE "competency_certificates" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "officer_kind" "OfficerKind",
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "competency_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_certificates_legacy_mongo_id_key" ON "competency_certificates"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "competency_certificates_business_id_idx" ON "competency_certificates"("business_id");

-- CreateIndex
CREATE INDEX "competency_certificates_name_business_id_idx" ON "competency_certificates"("name", "business_id");

-- CreateIndex
CREATE INDEX "competency_certificates_officer_kind_idx" ON "competency_certificates"("officer_kind");

-- AddForeignKey
ALTER TABLE "competency_certificates" ADD CONSTRAINT "competency_certificates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre certificados no borrados (portal viejo; lower para casing).
CREATE UNIQUE INDEX "competency_certificates_business_name_active_key"
ON "competency_certificates" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;
