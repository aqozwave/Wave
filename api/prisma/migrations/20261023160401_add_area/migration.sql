-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "location_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_legacy_mongo_id_key" ON "areas"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "areas_location_id_idx" ON "areas"("location_id");

-- CreateIndex
CREATE INDEX "areas_business_id_idx" ON "areas"("business_id");

-- CreateIndex
CREATE INDEX "areas_name_location_id_idx" ON "areas"("name", "location_id");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- CreateIndex
CREATE INDEX "users_area_id_idx" ON "users"("area_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por lugar de trabajo entre áreas no borradas (portal viejo).
CREATE UNIQUE INDEX "areas_location_name_active_key"
ON "areas" ("location_id", lower("name"))
WHERE "deleted_at" IS NULL;
