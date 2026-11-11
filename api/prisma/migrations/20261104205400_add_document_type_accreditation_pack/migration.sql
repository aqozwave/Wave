-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "accreditation_pack" "AccreditationScope";

-- CreateIndex
CREATE INDEX "document_types_accreditation_pack_idx" ON "document_types"("accreditation_pack");
