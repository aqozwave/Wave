-- CreateEnum
CREATE TYPE "WorkPermitSignatureKind" AS ENUM ('prevention_approve', 'captain_receive', 'contractor_request_close', 'captain_close', 'captain_no_closure');

-- CreateTable
CREATE TABLE "work_permit_signatures" (
    "id" UUID NOT NULL,
    "work_permit_id" UUID NOT NULL,
    "kind" "WorkPermitSignatureKind" NOT NULL,
    "signed_by_id" UUID,
    "signer_name" TEXT NOT NULL,
    "note" TEXT,
    "signed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_permit_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_permit_signatures_work_permit_id_idx" ON "work_permit_signatures"("work_permit_id");

-- CreateIndex
CREATE INDEX "work_permit_signatures_signed_by_id_idx" ON "work_permit_signatures"("signed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_permit_signatures_work_permit_id_kind_key" ON "work_permit_signatures"("work_permit_id", "kind");

-- AddForeignKey
ALTER TABLE "work_permit_signatures" ADD CONSTRAINT "work_permit_signatures_work_permit_id_fkey" FOREIGN KEY ("work_permit_id") REFERENCES "work_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_permit_signatures" ADD CONSTRAINT "work_permit_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
