-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "country" TEXT DEFAULT 'Chile',
    "commune" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "description" TEXT,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_legacy_mongo_id_key" ON "locations"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "locations_business_id_idx" ON "locations"("business_id");

-- CreateIndex
CREATE INDEX "locations_name_business_id_idx" ON "locations"("name", "business_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
