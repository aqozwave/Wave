-- CreateEnum
CREATE TYPE "AccreditationStatus" AS ENUM ('invited', 'pending', 'in_review', 'observed', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "ActivityResource" ADD VALUE 'contractorAccreditation';

-- CreateTable
CREATE TABLE "contractor_accreditations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "AccreditationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "review_note" TEXT,
    "requested_at" TIMESTAMPTZ,
    "requested_by_id" UUID,
    "due_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_accreditations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_accreditations_code_key" ON "contractor_accreditations"("code");

-- CreateIndex
CREATE INDEX "contractor_accreditations_organization_id_idx" ON "contractor_accreditations"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_accreditations_status_idx" ON "contractor_accreditations"("status");

-- CreateIndex
CREATE INDEX "contractor_accreditations_requested_at_idx" ON "contractor_accreditations"("requested_at");

-- AddForeignKey
ALTER TABLE "contractor_accreditations" ADD CONSTRAINT "contractor_accreditations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_accreditations" ADD CONSTRAINT "contractor_accreditations_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_accreditations" ADD CONSTRAINT "contractor_accreditations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
