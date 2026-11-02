-- CreateEnum
CREATE TYPE "NotificationOutboxType" AS ENUM ('boarding_book_expiring', 'course_expiring', 'course_expired', 'boarding_book_admin_digest', 'course_admin_digest');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "type" "NotificationOutboxType" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "business_id" UUID,
    "crew_member_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_legacy_mongo_id_key" ON "notification_outbox"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_outbox_status_next_attempt_at_idx" ON "notification_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_outbox_status_locked_at_idx" ON "notification_outbox"("status", "locked_at");

-- CreateIndex
CREATE INDEX "notification_outbox_crew_member_id_status_idx" ON "notification_outbox"("crew_member_id", "status");

-- CreateIndex
CREATE INDEX "notification_outbox_business_id_status_created_at_idx" ON "notification_outbox"("business_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
