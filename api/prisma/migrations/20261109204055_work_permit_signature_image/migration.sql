-- AlterTable
ALTER TABLE "work_permit_signatures" ADD COLUMN     "accepted_at" TIMESTAMPTZ,
ADD COLUMN     "signature_image" TEXT;
