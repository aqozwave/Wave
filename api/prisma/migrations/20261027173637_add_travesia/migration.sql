-- CreateTable
CREATE TABLE "travesias" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "required_passages" INTEGER NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "travesias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travesias_legacy_mongo_id_key" ON "travesias"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "travesias_business_id_idx" ON "travesias"("business_id");

-- CreateIndex
CREATE INDEX "travesias_name_business_id_idx" ON "travesias"("name", "business_id");

-- AddForeignKey
ALTER TABLE "travesias" ADD CONSTRAINT "travesias_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre travesías no borradas.
CREATE UNIQUE INDEX "travesias_business_name_active_key"
ON "travesias" ("business_id", lower("name"))
WHERE "deleted_at" IS NULL;
