-- CreateTable
CREATE TABLE "trainings" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validity_months" INTEGER,
    "applies_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "document_type_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- AlterTable: FK opcional desde exigencias de permiso
ALTER TABLE "permit_type_requirements" ADD COLUMN "training_id" UUID;

-- CreateIndex
CREATE INDEX "trainings_business_id_idx" ON "trainings"("business_id");

-- CreateIndex
CREATE INDEX "trainings_active_idx" ON "trainings"("active");

-- CreateIndex
CREATE UNIQUE INDEX "trainings_business_id_code_key" ON "trainings"("business_id", "code");

-- CreateIndex
CREATE INDEX "permit_type_requirements_training_id_idx" ON "permit_type_requirements"("training_id");

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_type_requirements" ADD CONSTRAINT "permit_type_requirements_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
