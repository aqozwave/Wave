-- CreateEnum
CREATE TYPE "CrewCourseStatus" AS ENUM ('pending', 'valid', 'expiring_soon', 'expired');

-- CreateEnum
CREATE TYPE "CrewCourseSource" AS ENUM ('rank', 'certificate', 'manual');

-- CreateTable
CREATE TABLE "competency_certificate_courses" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "competency_certificate_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "competency_certificate_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_member_courses" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "crew_member_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "status" "CrewCourseStatus" NOT NULL DEFAULT 'pending',
    "source" "CrewCourseSource" NOT NULL DEFAULT 'manual',
    "last_expiring_email_at" TIMESTAMPTZ,
    "last_expired_email_at" TIMESTAMPTZ,
    "expiring_milestones_sent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_certificate_courses_legacy_mongo_id_key" ON "competency_certificate_courses"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "competency_certificate_courses_competency_certificate_id_idx" ON "competency_certificate_courses"("competency_certificate_id");

-- CreateIndex
CREATE INDEX "competency_certificate_courses_course_id_idx" ON "competency_certificate_courses"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_courses_legacy_mongo_id_key" ON "crew_member_courses"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "crew_member_courses_crew_member_id_idx" ON "crew_member_courses"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_courses_course_id_idx" ON "crew_member_courses"("course_id");

-- CreateIndex
CREATE INDEX "crew_member_courses_expires_at_idx" ON "crew_member_courses"("expires_at");

-- CreateIndex
CREATE INDEX "crew_member_courses_status_idx" ON "crew_member_courses"("status");

-- AddForeignKey
ALTER TABLE "competency_certificate_courses" ADD CONSTRAINT "competency_certificate_courses_competency_certificate_id_fkey" FOREIGN KEY ("competency_certificate_id") REFERENCES "competency_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_certificate_courses" ADD CONSTRAINT "competency_certificate_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_courses" ADD CONSTRAINT "crew_member_courses_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_courses" ADD CONSTRAINT "crew_member_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Par único activo título↔curso.
CREATE UNIQUE INDEX "competency_certificate_courses_cert_course_active_key"
ON "competency_certificate_courses" ("competency_certificate_id", "course_id")
WHERE "deleted_at" IS NULL;

-- Par único activo tripulante↔curso.
CREATE UNIQUE INDEX "crew_member_courses_crew_course_active_key"
ON "crew_member_courses" ("crew_member_id", "course_id")
WHERE "deleted_at" IS NULL;
