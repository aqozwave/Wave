-- CreateEnum
CREATE TYPE "ContractorDocumentStatus" AS ENUM ('pending_validation', 'validated', 'observed', 'replaced');

-- AlterEnum
ALTER TYPE "ActivityResource" ADD VALUE 'contractorOrgDocument';

-- CreateTable
CREATE TABLE "contractor_org_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "accreditation_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "status" "ContractorDocumentStatus" NOT NULL DEFAULT 'pending_validation',
    "observation" TEXT,
    "expires_at" TIMESTAMPTZ,
    "uploaded_by_id" UUID,
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_org_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_org_documents_organization_id_idx" ON "contractor_org_documents"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_org_documents_accreditation_id_idx" ON "contractor_org_documents"("accreditation_id");

-- CreateIndex
CREATE INDEX "contractor_org_documents_document_type_id_idx" ON "contractor_org_documents"("document_type_id");

-- CreateIndex
CREATE INDEX "contractor_org_documents_status_idx" ON "contractor_org_documents"("status");

-- AddForeignKey
ALTER TABLE "contractor_org_documents" ADD CONSTRAINT "contractor_org_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_org_documents" ADD CONSTRAINT "contractor_org_documents_accreditation_id_fkey" FOREIGN KEY ("accreditation_id") REFERENCES "contractor_accreditations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_org_documents" ADD CONSTRAINT "contractor_org_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_org_documents" ADD CONSTRAINT "contractor_org_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_org_documents" ADD CONSTRAINT "contractor_org_documents_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
