-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationOutboxType" ADD VALUE 'training_expiring';
ALTER TYPE "NotificationOutboxType" ADD VALUE 'training_expired';
ALTER TYPE "NotificationOutboxType" ADD VALUE 'training_admin_digest';
ALTER TYPE "NotificationOutboxType" ADD VALUE 'work_notice_created';

-- AlterTable
ALTER TABLE "crew_member_trainings" ADD COLUMN     "expiring_milestones_sent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "last_expired_email_at" TIMESTAMPTZ,
ADD COLUMN     "last_expiring_email_at" TIMESTAMPTZ;
