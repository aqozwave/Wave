-- CreateEnum
CREATE TYPE "SystemAnnouncementKind" AS ENUM ('version', 'maintenance', 'config');

-- CreateTable
CREATE TABLE "system_announcements" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "dedupe_key" TEXT,
    "kind" "SystemAnnouncementKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_announcement_reads" (
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_announcement_reads_pkey" PRIMARY KEY ("user_id","announcement_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_announcements_legacy_mongo_id_key" ON "system_announcements"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_announcements_dedupe_key_key" ON "system_announcements"("dedupe_key");

-- CreateIndex
CREATE INDEX "system_announcements_deleted_at_published_at_idx" ON "system_announcements"("deleted_at", "published_at");

-- CreateIndex
CREATE INDEX "user_announcement_reads_user_id_idx" ON "user_announcement_reads"("user_id");

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "system_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
