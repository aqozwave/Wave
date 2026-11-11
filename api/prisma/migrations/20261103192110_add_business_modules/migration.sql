-- CreateEnum
CREATE TYPE "BusinessModuleKey" AS ENUM ('contractors', 'work_permits', 'trainings');

-- CreateTable
CREATE TABLE "business_modules" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "key" "BusinessModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabled_at" TIMESTAMPTZ,
    "enabled_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_modules_business_id_idx" ON "business_modules"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_modules_business_id_key_key" ON "business_modules"("business_id", "key");

-- AddForeignKey
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_enabled_by_id_fkey" FOREIGN KEY ("enabled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
