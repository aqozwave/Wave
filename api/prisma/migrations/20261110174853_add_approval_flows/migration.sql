-- CreateEnum
CREATE TYPE "ApprovalFlowStageActor" AS ENUM ('requesting_area', 'prevention', 'contractor', 'captain');

-- CreateEnum
CREATE TYPE "ApprovalFlowStageMoment" AS ENUM ('before', 'on_arrival', 'on_finish');

-- AlterTable
ALTER TABLE "permit_types" ADD COLUMN     "default_approval_flow_id" UUID;

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "copied_from_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_stages" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "actor" "ApprovalFlowStageActor" NOT NULL,
    "moment" "ApprovalFlowStageMoment" NOT NULL,
    "requires_signature" BOOLEAN NOT NULL DEFAULT false,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "approval_flow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_flows_business_id_idx" ON "approval_flows"("business_id");

-- CreateIndex
CREATE INDEX "approval_flows_active_idx" ON "approval_flows"("active");

-- CreateIndex
CREATE INDEX "approval_flows_is_system_idx" ON "approval_flows"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flows_business_id_code_key" ON "approval_flows"("business_id", "code");

-- CreateIndex
CREATE INDEX "approval_flow_stages_flow_id_idx" ON "approval_flow_stages"("flow_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_stages_flow_id_position_key" ON "approval_flow_stages"("flow_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_stages_flow_id_key_key" ON "approval_flow_stages"("flow_id", "key");

-- CreateIndex
CREATE INDEX "permit_types_default_approval_flow_id_idx" ON "permit_types"("default_approval_flow_id");

-- AddForeignKey
ALTER TABLE "permit_types" ADD CONSTRAINT "permit_types_default_approval_flow_id_fkey" FOREIGN KEY ("default_approval_flow_id") REFERENCES "approval_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "approval_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_stages" ADD CONSTRAINT "approval_flow_stages_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
