-- CreateEnum
CREATE TYPE "ContractorRole" AS ENUM ('permanent', 'occasional');

-- CreateTable
CREATE TABLE "contractor_organizations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "role" "ContractorRole" NOT NULL,
    "specialty" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "legal_representative" TEXT,
    "address" TEXT,
    "mutual" TEXT,
    "supervisor_name" TEXT,
    "supervisor_email" TEXT,
    "prevencionist_name" TEXT,
    "prevencionist_email" TEXT,
    "subcontractors" TEXT,
    "work_description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_organizations_business_id_idx" ON "contractor_organizations"("business_id");

-- CreateIndex
CREATE INDEX "contractor_organizations_active_idx" ON "contractor_organizations"("active");

-- CreateIndex
CREATE INDEX "contractor_organizations_name_idx" ON "contractor_organizations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_organizations_business_id_rut_key" ON "contractor_organizations"("business_id", "rut");

-- AddForeignKey
ALTER TABLE "contractor_organizations" ADD CONSTRAINT "contractor_organizations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
