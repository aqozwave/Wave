-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('draft', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "CrewLogEntryKind" ADD VALUE 'training';

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "held_at" TIMESTAMPTZ NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "file_path" TEXT,
    "file_original_name" TEXT,
    "file_mime_type" TEXT,
    "file_size" INTEGER,
    "closed_at" TIMESTAMPTZ,
    "closed_by_id" UUID,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_session_attendees" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "crew_member_id" UUID NOT NULL,
    "crew_member_training_id" UUID,
    "evidence_document_id" UUID,
    "log_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "training_session_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_sessions_business_id_idx" ON "training_sessions"("business_id");

-- CreateIndex
CREATE INDEX "training_sessions_training_id_idx" ON "training_sessions"("training_id");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");

-- CreateIndex
CREATE INDEX "training_sessions_held_at_idx" ON "training_sessions"("held_at");

-- CreateIndex
CREATE INDEX "training_session_attendees_crew_member_id_idx" ON "training_session_attendees"("crew_member_id");

-- CreateIndex
CREATE INDEX "training_session_attendees_crew_member_training_id_idx" ON "training_session_attendees"("crew_member_training_id");

-- CreateIndex
CREATE INDEX "training_session_attendees_evidence_document_id_idx" ON "training_session_attendees"("evidence_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_session_attendees_session_id_crew_member_id_key" ON "training_session_attendees"("session_id", "crew_member_id");

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
