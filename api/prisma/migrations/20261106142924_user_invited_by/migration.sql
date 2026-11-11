-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invited_by_id" UUID;

-- CreateIndex
CREATE INDEX "users_invited_by_id_idx" ON "users"("invited_by_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
