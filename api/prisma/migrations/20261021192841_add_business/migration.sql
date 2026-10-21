-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "rut" TEXT,
    "name" TEXT NOT NULL,
    "giro" TEXT,
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

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_legacy_mongo_id_key" ON "businesses"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "businesses_name_idx" ON "businesses"("name");

-- CreateIndex
CREATE INDEX "users_business_id_idx" ON "users"("business_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
