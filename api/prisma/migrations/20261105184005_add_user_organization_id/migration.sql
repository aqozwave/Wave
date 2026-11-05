-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organization_id" UUID;

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "contractor_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
