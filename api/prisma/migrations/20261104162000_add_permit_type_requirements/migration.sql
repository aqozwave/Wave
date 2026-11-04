-- CreateEnum
CREATE TYPE "PermitRequirementKind" AS ENUM ('document', 'training', 'checklist');

-- CreateEnum
CREATE TYPE "PermitRequirementScope" AS ENUM ('company', 'person', 'permit');

-- CreateEnum
CREATE TYPE "PermitRequirementMoment" AS ENUM ('before', 'closure');

-- CreateEnum
CREATE TYPE "AccreditationScope" AS ENUM ('company', 'person');

-- CreateTable
CREATE TABLE "permit_type_requirements" (
    "id" UUID NOT NULL,
    "permit_type_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "PermitRequirementKind" NOT NULL,
    "scope" "PermitRequirementScope" NOT NULL,
    "moment" "PermitRequirementMoment" NOT NULL DEFAULT 'before',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "document_type_id" UUID,
    "accreditation_scope" "AccreditationScope",
    "training_code" TEXT,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permit_type_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permit_type_requirements_permit_type_id_idx" ON "permit_type_requirements"("permit_type_id");

-- CreateIndex
CREATE INDEX "permit_type_requirements_kind_idx" ON "permit_type_requirements"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "permit_type_requirements_permit_type_id_key_key" ON "permit_type_requirements"("permit_type_id", "key");

-- AddForeignKey
ALTER TABLE "permit_type_requirements" ADD CONSTRAINT "permit_type_requirements_permit_type_id_fkey" FOREIGN KEY ("permit_type_id") REFERENCES "permit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_type_requirements" ADD CONSTRAINT "permit_type_requirements_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
