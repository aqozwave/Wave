-- CreateTable
CREATE TABLE "permit_checklist_items" (
    "id" UUID NOT NULL,
    "permit_type_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permit_checklist_items_permit_type_id_idx" ON "permit_checklist_items"("permit_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "permit_checklist_items_permit_type_id_order_key" ON "permit_checklist_items"("permit_type_id", "order");

-- AddForeignKey
ALTER TABLE "permit_checklist_items" ADD CONSTRAINT "permit_checklist_items_permit_type_id_fkey" FOREIGN KEY ("permit_type_id") REFERENCES "permit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
