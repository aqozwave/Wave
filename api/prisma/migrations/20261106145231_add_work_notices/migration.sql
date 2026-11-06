-- CreateEnum
CREATE TYPE "WorkNoticeStatus" AS ENUM ('pending', 'cancelled');

-- AlterEnum
ALTER TYPE "ActivityResource" ADD VALUE 'workNotice';

-- CreateTable
CREATE TABLE "work_notices" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "permit_type_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "tentative_date" DATE NOT NULL,
    "estimated_duration_days" INTEGER,
    "description" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notify_by_email" BOOLEAN NOT NULL DEFAULT true,
    "status" "WorkNoticeStatus" NOT NULL DEFAULT 'pending',
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_notices_code_key" ON "work_notices"("code");

-- CreateIndex
CREATE INDEX "work_notices_business_id_idx" ON "work_notices"("business_id");

-- CreateIndex
CREATE INDEX "work_notices_organization_id_idx" ON "work_notices"("organization_id");

-- CreateIndex
CREATE INDEX "work_notices_permit_type_id_idx" ON "work_notices"("permit_type_id");

-- CreateIndex
CREATE INDEX "work_notices_location_id_idx" ON "work_notices"("location_id");

-- CreateIndex
CREATE INDEX "work_notices_status_idx" ON "work_notices"("status");

-- CreateIndex
CREATE INDEX "work_notices_tentative_date_idx" ON "work_notices"("tentative_date");

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_permit_type_id_fkey" FOREIGN KEY ("permit_type_id") REFERENCES "permit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notices" ADD CONSTRAINT "work_notices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
