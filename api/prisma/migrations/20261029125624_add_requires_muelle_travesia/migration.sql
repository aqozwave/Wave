-- AlterTable
ALTER TABLE "competency_certificates" ADD COLUMN     "requires_muelle_travesia" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: títulos ya marcados capitán / primer piloto exigen muelles y travesías.
UPDATE "competency_certificates"
SET "requires_muelle_travesia" = true
WHERE "officer_kind" IN ('captain', 'first_pilot');

-- CreateIndex
CREATE INDEX "competency_certificates_requires_muelle_travesia_idx" ON "competency_certificates"("requires_muelle_travesia");
