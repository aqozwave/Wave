-- AlterEnum
ALTER TYPE "ActivityResource" ADD VALUE 'contractorPerson';

-- CreateTable
CREATE TABLE "contractor_people" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rut" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "emergency_contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_people_organization_id_idx" ON "contractor_people"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_people_active_idx" ON "contractor_people"("active");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_people_organization_id_rut_key" ON "contractor_people"("organization_id", "rut");

-- AddForeignKey
ALTER TABLE "contractor_people" ADD CONSTRAINT "contractor_people_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
