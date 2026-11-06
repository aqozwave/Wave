-- CreateEnum
CREATE TYPE "WorkPermitStatus" AS ENUM ('to_complete', 'to_approve', 'to_receive', 'active', 'to_verify', 'closed', 'no_closure');

-- AlterEnum
ALTER TYPE "ActivityResource" ADD VALUE 'workPermit';

-- AlterEnum
ALTER TYPE "WorkNoticeStatus" ADD VALUE 'linked';

-- CreateTable
CREATE TABLE "work_permits" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "work_notice_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "permit_type_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "description" TEXT,
    "status" "WorkPermitStatus" NOT NULL DEFAULT 'to_complete',
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_permits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_permits_code_key" ON "work_permits"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_permits_work_notice_id_key" ON "work_permits"("work_notice_id");

-- CreateIndex
CREATE INDEX "work_permits_business_id_idx" ON "work_permits"("business_id");

-- CreateIndex
CREATE INDEX "work_permits_organization_id_idx" ON "work_permits"("organization_id");

-- CreateIndex
CREATE INDEX "work_permits_permit_type_id_idx" ON "work_permits"("permit_type_id");

-- CreateIndex
CREATE INDEX "work_permits_location_id_idx" ON "work_permits"("location_id");

-- CreateIndex
CREATE INDEX "work_permits_status_idx" ON "work_permits"("status");

-- CreateIndex
CREATE INDEX "work_permits_scheduled_date_idx" ON "work_permits"("scheduled_date");

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_work_notice_id_fkey" FOREIGN KEY ("work_notice_id") REFERENCES "work_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_permit_type_id_fkey" FOREIGN KEY ("permit_type_id") REFERENCES "permit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
