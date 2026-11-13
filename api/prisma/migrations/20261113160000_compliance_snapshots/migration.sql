-- Snapshots mensuales de cumplimiento (Panel chart por empresa / nave).
CREATE TABLE "compliance_snapshots" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID,
    "period_month" DATE NOT NULL,
    "compliance_percent" INTEGER,
    "crew_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "compliance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compliance_snapshots_business_id_period_month_idx" ON "compliance_snapshots"("business_id", "period_month");
CREATE INDEX "compliance_snapshots_location_id_period_month_idx" ON "compliance_snapshots"("location_id", "period_month");

-- Empresa (location null) y nave (location set) sin cruzarse.
CREATE UNIQUE INDEX "compliance_snapshots_business_month_uq"
  ON "compliance_snapshots" ("business_id", "period_month")
  WHERE "location_id" IS NULL;

CREATE UNIQUE INDEX "compliance_snapshots_location_month_uq"
  ON "compliance_snapshots" ("business_id", "location_id", "period_month")
  WHERE "location_id" IS NOT NULL;

ALTER TABLE "compliance_snapshots" ADD CONSTRAINT "compliance_snapshots_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compliance_snapshots" ADD CONSTRAINT "compliance_snapshots_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
