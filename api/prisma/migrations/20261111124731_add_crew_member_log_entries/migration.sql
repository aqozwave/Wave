-- CreateEnum
CREATE TYPE "CrewLogEntryKind" AS ENUM ('observation', 'sanction', 'boarding');

-- CreateTable
CREATE TABLE "crew_member_log_entries" (
    "id" UUID NOT NULL,
    "crew_member_id" UUID NOT NULL,
    "kind" "CrewLogEntryKind" NOT NULL,
    "note" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_member_log_entries_crew_member_id_idx" ON "crew_member_log_entries"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_log_entries_kind_idx" ON "crew_member_log_entries"("kind");

-- CreateIndex
CREATE INDEX "crew_member_log_entries_occurred_at_idx" ON "crew_member_log_entries"("occurred_at");

-- AddForeignKey
ALTER TABLE "crew_member_log_entries" ADD CONSTRAINT "crew_member_log_entries_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_log_entries" ADD CONSTRAINT "crew_member_log_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
