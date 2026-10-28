-- AlterTable
ALTER TABLE "ports" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "crew_members" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "run" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birth_date" TIMESTAMPTZ,
    "nationality" TEXT,
    "phone" TEXT,
    "direction" TEXT,
    "observation" TEXT,
    "boarding_book_valid_until" TIMESTAMPTZ NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "area_id" UUID,
    "rank_id" UUID,
    "academic_degree_id" UUID,
    "competency_certificate_id" UUID,
    "user_id" UUID,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crew_members_legacy_mongo_id_key" ON "crew_members"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_members_user_id_key" ON "crew_members"("user_id");

-- CreateIndex
CREATE INDEX "crew_members_business_id_idx" ON "crew_members"("business_id");

-- CreateIndex
CREATE INDEX "crew_members_location_id_idx" ON "crew_members"("location_id");

-- CreateIndex
CREATE INDEX "crew_members_area_id_idx" ON "crew_members"("area_id");

-- CreateIndex
CREATE INDEX "crew_members_rank_id_idx" ON "crew_members"("rank_id");

-- CreateIndex
CREATE INDEX "crew_members_academic_degree_id_idx" ON "crew_members"("academic_degree_id");

-- CreateIndex
CREATE INDEX "crew_members_competency_certificate_id_idx" ON "crew_members"("competency_certificate_id");

-- CreateIndex
CREATE INDEX "crew_members_run_business_id_idx" ON "crew_members"("run", "business_id");

-- CreateIndex
CREATE INDEX "crew_members_email_business_id_idx" ON "crew_members"("email", "business_id");

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_rank_id_fkey" FOREIGN KEY ("rank_id") REFERENCES "ranks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_academic_degree_id_fkey" FOREIGN KEY ("academic_degree_id") REFERENCES "academic_degrees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_competency_certificate_id_fkey" FOREIGN KEY ("competency_certificate_id") REFERENCES "competency_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
