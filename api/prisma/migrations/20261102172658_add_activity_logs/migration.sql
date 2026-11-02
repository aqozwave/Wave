-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ActivityResource" AS ENUM ('auth', 'user', 'business', 'location', 'crewMember', 'crewMemberCourse', 'area', 'rank', 'academicDegree', 'competencyCertificate', 'muelle', 'travesia', 'course', 'role', 'system');

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "action" "ActivityAction" NOT NULL,
    "resource" "ActivityResource" NOT NULL,
    "resource_id" TEXT,
    "actor_id" UUID,
    "actor_username" TEXT,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "target_label" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_legacy_mongo_id_key" ON "activity_logs"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_actor_id_created_at_idx" ON "activity_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_resource_action_created_at_idx" ON "activity_logs"("resource", "action", "created_at");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
