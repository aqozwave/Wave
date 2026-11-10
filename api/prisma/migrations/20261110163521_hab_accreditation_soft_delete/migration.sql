-- AlterTable
ALTER TABLE "contractor_accreditations" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "contractor_accreditations_deleted_at_idx" ON "contractor_accreditations"("deleted_at");
