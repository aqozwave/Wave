-- Campos Figma D41: aplica a, vence, lo suben / lo ven, tripulante puede ver.
ALTER TABLE "document_types"
  ADD COLUMN "applies_to" TEXT NOT NULL DEFAULT 'crew_and_external',
  ADD COLUMN "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "upload_by" TEXT NOT NULL DEFAULT 'prevention_or_admin',
  ADD COLUMN "view_by" TEXT NOT NULL DEFAULT 'prevention_or_admin',
  ADD COLUMN "crew_can_view" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: si la visibilidad legacy no incluye empleado, el tripulante no ve.
UPDATE "document_types"
SET "crew_can_view" = false
WHERE "visibility" IN ('nobody', 'supervisor')
  AND "deleted_at" IS NULL;

CREATE INDEX "document_types_applies_to_idx" ON "document_types"("applies_to");
