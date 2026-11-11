-- CreateEnum
CREATE TYPE "CrewTrainingStatus" AS ENUM ('pending', 'valid', 'expiring_soon', 'expired');

-- AlterTable
ALTER TABLE "crew_member_documents" ADD COLUMN     "expires_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "crew_member_trainings" (
    "id" UUID NOT NULL,
    "crew_member_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "status" "CrewTrainingStatus" NOT NULL DEFAULT 'pending',
    "evidence_document_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_member_trainings_crew_member_id_idx" ON "crew_member_trainings"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_trainings_training_id_idx" ON "crew_member_trainings"("training_id");

-- CreateIndex
CREATE INDEX "crew_member_trainings_expires_at_idx" ON "crew_member_trainings"("expires_at");

-- CreateIndex
CREATE INDEX "crew_member_trainings_status_idx" ON "crew_member_trainings"("status");

-- CreateIndex
CREATE INDEX "crew_member_trainings_evidence_document_id_idx" ON "crew_member_trainings"("evidence_document_id");

-- CreateIndex
CREATE INDEX "crew_member_documents_expires_at_idx" ON "crew_member_documents"("expires_at");

-- AddForeignKey
ALTER TABLE "crew_member_trainings" ADD CONSTRAINT "crew_member_trainings_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_trainings" ADD CONSTRAINT "crew_member_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_trainings" ADD CONSTRAINT "crew_member_trainings_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "crew_member_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Par único activo tripulante ↔ capacitación.
CREATE UNIQUE INDEX "crew_member_trainings_crew_training_active_key"
ON "crew_member_trainings" ("crew_member_id", "training_id")
WHERE "deleted_at" IS NULL;
