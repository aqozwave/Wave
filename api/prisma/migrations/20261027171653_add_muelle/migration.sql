-- CreateTable
CREATE TABLE "muelles" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "port_name" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "muelles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "muelles_legacy_mongo_id_key" ON "muelles"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "muelles_business_id_idx" ON "muelles"("business_id");

-- CreateIndex
CREATE INDEX "muelles_port_name_idx" ON "muelles"("port_name");

-- CreateIndex
CREATE INDEX "muelles_name_port_name_business_id_idx" ON "muelles"("name", "port_name", "business_id");

-- AddForeignKey
ALTER TABLE "muelles" ADD CONSTRAINT "muelles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa + puerto entre muelles no borrados.
CREATE UNIQUE INDEX "muelles_business_port_name_active_key"
ON "muelles" ("business_id", "port_name", lower("name"))
WHERE "deleted_at" IS NULL;