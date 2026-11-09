-- CreateEnum
CREATE TYPE "WorkPermitChecklistStage" AS ENUM ('contractor', 'reception', 'closure');

-- CreateEnum
CREATE TYPE "WorkPermitChecklistAnswerValue" AS ENUM ('yes', 'no', 'na');

-- CreateTable
CREATE TABLE "work_permit_people" (
    "work_permit_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "present_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_permit_people_pkey" PRIMARY KEY ("work_permit_id","person_id")
);

-- CreateTable
CREATE TABLE "work_permit_checklist_answers" (
    "id" UUID NOT NULL,
    "work_permit_id" UUID NOT NULL,
    "stage" "WorkPermitChecklistStage" NOT NULL,
    "checklist_item_id" UUID NOT NULL,
    "item_text" TEXT NOT NULL,
    "answer" "WorkPermitChecklistAnswerValue" NOT NULL,
    "answered_by_id" UUID,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_permit_checklist_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_permit_people_person_id_idx" ON "work_permit_people"("person_id");

-- CreateIndex
CREATE INDEX "work_permit_checklist_answers_work_permit_id_stage_idx" ON "work_permit_checklist_answers"("work_permit_id", "stage");

-- CreateIndex
CREATE INDEX "work_permit_checklist_answers_checklist_item_id_idx" ON "work_permit_checklist_answers"("checklist_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_permit_checklist_answers_work_permit_id_stage_checklis_key" ON "work_permit_checklist_answers"("work_permit_id", "stage", "checklist_item_id");

-- AddForeignKey
ALTER TABLE "work_permit_people" ADD CONSTRAINT "work_permit_people_work_permit_id_fkey" FOREIGN KEY ("work_permit_id") REFERENCES "work_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permit_people" ADD CONSTRAINT "work_permit_people_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "contractor_people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permit_checklist_answers" ADD CONSTRAINT "work_permit_checklist_answers_work_permit_id_fkey" FOREIGN KEY ("work_permit_id") REFERENCES "work_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permit_checklist_answers" ADD CONSTRAINT "work_permit_checklist_answers_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "permit_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permit_checklist_answers" ADD CONSTRAINT "work_permit_checklist_answers_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
