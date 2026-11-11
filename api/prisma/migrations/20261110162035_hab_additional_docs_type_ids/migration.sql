-- AlterTable
ALTER TABLE "contractor_accreditations" ADD COLUMN     "additional_docs_type_ids" UUID[] DEFAULT ARRAY[]::UUID[];
