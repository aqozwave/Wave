-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "name" TEXT NOT NULL,
    "where_taught" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "description" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_legacy_mongo_id_key" ON "courses"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "courses_business_id_idx" ON "courses"("business_id");

-- CreateIndex
CREATE INDEX "courses_name_where_taught_business_id_idx" ON "courses"("name", "where_taught", "business_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Único por empresa + nombre + lugar de dictado entre no borrados (portal viejo).
CREATE UNIQUE INDEX "courses_business_name_where_active_key"
ON "courses" ("business_id", lower("name"), lower("where_taught"))
WHERE "deleted_at" IS NULL;
