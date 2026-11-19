-- AlterEnum
ALTER TYPE "NotificationOutboxType" ADD VALUE 'birthday_admin';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "birth_date" TIMESTAMPTZ;
