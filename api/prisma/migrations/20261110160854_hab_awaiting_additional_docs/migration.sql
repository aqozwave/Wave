-- AlterTable
ALTER TABLE "contractor_accreditations" ADD COLUMN     "additional_docs_message" TEXT,
ADD COLUMN     "awaiting_additional_docs" BOOLEAN NOT NULL DEFAULT false;
