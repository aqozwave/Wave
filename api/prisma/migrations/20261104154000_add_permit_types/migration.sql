-- CreateEnum
CREATE TYPE "PermitCriticality" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "PermitAstMode" AS ENUM ('form', 'pdf', 'both');

-- CreateTable
CREATE TABLE "permit_types" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criticality" "PermitCriticality" NOT NULL,
    "requires_ast" BOOLEAN NOT NULL DEFAULT false,
    "ast_mode" "PermitAstMode",
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permit_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permit_types_business_id_idx" ON "permit_types"("business_id");

-- CreateIndex
CREATE INDEX "permit_types_active_idx" ON "permit_types"("active");

-- CreateIndex
CREATE UNIQUE INDEX "permit_types_business_id_code_key" ON "permit_types"("business_id", "code");

-- AddForeignKey
ALTER TABLE "permit_types" ADD CONSTRAINT "permit_types_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
