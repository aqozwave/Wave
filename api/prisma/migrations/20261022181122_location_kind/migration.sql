-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('vessel', 'office', 'warehouse', 'other');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "kind" "LocationKind";

-- CreateIndex
CREATE INDEX "locations_kind_idx" ON "locations"("kind");
