-- CreateTable
CREATE TABLE "crew_member_muelles" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "crew_member_id" UUID NOT NULL,
    "muelle_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_muelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_member_travesias" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "crew_member_id" UUID NOT NULL,
    "travesia_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "crew_member_travesias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_muelles_legacy_mongo_id_key" ON "crew_member_muelles"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "crew_member_muelles_crew_member_id_idx" ON "crew_member_muelles"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_muelles_muelle_id_idx" ON "crew_member_muelles"("muelle_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_travesias_legacy_mongo_id_key" ON "crew_member_travesias"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "crew_member_travesias_crew_member_id_idx" ON "crew_member_travesias"("crew_member_id");

-- CreateIndex
CREATE INDEX "crew_member_travesias_travesia_id_idx" ON "crew_member_travesias"("travesia_id");

-- AddForeignKey
ALTER TABLE "crew_member_muelles" ADD CONSTRAINT "crew_member_muelles_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_muelles" ADD CONSTRAINT "crew_member_muelles_muelle_id_fkey" FOREIGN KEY ("muelle_id") REFERENCES "muelles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_travesias" ADD CONSTRAINT "crew_member_travesias_crew_member_id_fkey" FOREIGN KEY ("crew_member_id") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_travesias" ADD CONSTRAINT "crew_member_travesias_travesia_id_fkey" FOREIGN KEY ("travesia_id") REFERENCES "travesias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Par único activo tripulante↔muelle.
CREATE UNIQUE INDEX "crew_member_muelles_crew_muelle_active_key"
ON "crew_member_muelles" ("crew_member_id", "muelle_id")
WHERE "deleted_at" IS NULL;

-- Par único activo tripulante↔travesía.
CREATE UNIQUE INDEX "crew_member_travesias_crew_travesia_active_key"
ON "crew_member_travesias" ("crew_member_id", "travesia_id")
WHERE "deleted_at" IS NULL;
