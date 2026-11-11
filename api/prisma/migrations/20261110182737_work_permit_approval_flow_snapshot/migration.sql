-- AlterTable
ALTER TABLE "work_permits" ADD COLUMN     "approval_flow_id" UUID,
ADD COLUMN     "approval_flow_snapshot" JSONB;

-- CreateIndex
CREATE INDEX "work_permits_approval_flow_id_idx" ON "work_permits"("approval_flow_id");

-- AddForeignKey
ALTER TABLE "work_permits" ADD CONSTRAINT "work_permits_approval_flow_id_fkey" FOREIGN KEY ("approval_flow_id") REFERENCES "approval_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
