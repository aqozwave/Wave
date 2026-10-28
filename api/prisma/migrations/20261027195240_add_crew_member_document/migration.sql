-- CreateTable
CREATE TABLE "crew_member_documents" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "crew_member_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_documents_legacy_mongo_id_key" ON "crew_member_documents"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "crew_member_documents_crew_member_id_idx" ON "crew_member_documents"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_documents_type_idx" ON "crew_member_documents"("type");

-- AddForeignKey
ALTER TABLE "crew_member_documents" ADD CONSTRAINT "crew_member_documents_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_documents" ADD CONSTRAINT "crew_member_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
