-- AlterTable
ALTER TABLE "crew_member_log_entries" ADD COLUMN "document_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_log_entries_document_id_key" ON "crew_member_log_entries"("document_id");

-- AddForeignKey
ALTER TABLE "crew_member_log_entries" ADD CONSTRAINT "crew_member_log_entries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "crew_member_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
