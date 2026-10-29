-- CreateTable document_types
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT 'general',
    "visibility" TEXT NOT NULL DEFAULT 'employee',
    "business_id" UUID NOT NULL,
    "state" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_types_legacy_mongo_id_key" ON "document_types"("legacy_mongo_id");
CREATE INDEX "document_types_business_id_idx" ON "document_types"("business_id");
CREATE INDEX "document_types_code_business_id_idx" ON "document_types"("code", "business_id");
CREATE INDEX "document_types_subtype_idx" ON "document_types"("subtype");

-- Unique code por empresa entre no borrados
CREATE UNIQUE INDEX "document_types_code_business_alive_uidx"
  ON "document_types" ("code", "business_id")
  WHERE "deleted_at" IS NULL;

ALTER TABLE "document_types"
  ADD CONSTRAINT "document_types_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: tipos HR por cada empresa existente
INSERT INTO "document_types" ("id", "code", "name", "subtype", "visibility", "business_id", "state", "created_at", "updated_at")
SELECT gen_random_uuid(), s.code, s.name, s.subtype, s.visibility, b.id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "businesses" b
CROSS JOIN (
  VALUES
    ('CO', 'Contrato', 'general', 'employee_supervisor'),
    ('ANE', 'Anexo contrato aumento y prev delito', 'general', 'supervisor'),
    ('VI', 'Vigencia libreta de embarco', 'maritimo', 'employee'),
    ('TI', 'Título libreta de embarco', 'maritimo', 'employee'),
    ('DT', 'Datos personales libreta de embarco', 'maritimo', 'employee'),
    ('CR', 'Certificado médico libreta de embarco', 'maritimo', 'employee'),
    ('HA', 'Habilitación practicaje (pasadas)', 'maritimo', 'employee'),
    ('EN', 'Entrega de EPP', 'prevencion', 'employee'),
    ('WL', 'Carta de amonestación', 'prevencion', 'supervisor'),
    ('AS', 'Asignación de activo', 'activo', 'employee'),
    ('DA', 'Devolución activos', 'activo', 'employee'),
    ('EX', 'Examen ocupacional básico', 'prevencion', 'employee'),
    ('EA', 'Examen ocupacional altura', 'prevencion', 'employee'),
    ('EE', 'Examen ocupacional trabajo a bordo', 'prevencion', 'employee'),
    ('EM', 'Examen ocupacional espacios confinados', 'prevencion', 'employee'),
    ('EC', 'Examen ocupacional exposición a ruido', 'prevencion', 'employee'),
    ('EO', 'Examen ocupacional conducción vehículo', 'prevencion', 'employee'),
    ('HI', 'Historia ocupacional', 'prevencion', 'employee'),
    ('CU', 'Cuestionario de salud', 'prevencion', 'employee'),
    ('DS', 'Derecho a saber', 'prevencion', 'employee'),
    ('RI', 'Reglamento interno', 'general', 'employee'),
    ('CD', 'Cédula de identidad', 'general', 'employee_supervisor'),
    ('CE', 'Certificado académico', 'general', 'employee_supervisor'),
    ('OM', 'OMI 1-13 primeros auxilios', 'maritimo', 'employee'),
    ('OI', 'OMI 1-19 supervivencia personal', 'maritimo', 'employee'),
    ('OF', 'OMI 3-26 formación gente de mar', 'maritimo', 'employee'),
    ('OC', 'OMI 1-28 control multitudes', 'maritimo', 'employee'),
    ('OA', 'OMI 1-10 cargas peligrosas', 'maritimo', 'employee'),
    ('OP', 'OMI 1-20 prevención y lucha contra incendio', 'maritimo', 'employee'),
    ('OS', 'OMI 1-21 seguridad social', 'maritimo', 'employee'),
    ('OV', 'OMI varios', 'maritimo', 'employee')
) AS s(code, name, subtype, visibility)
WHERE b.deleted_at IS NULL;

-- Añadir columnas nuevas en documentos (nullable primero)
ALTER TABLE "crew_member_documents" ADD COLUMN "document_type_id" UUID;
ALTER TABLE "crew_member_documents" ADD COLUMN "source_module" TEXT NOT NULL DEFAULT 'crew';

-- Backfill: warning_letter → WL de la empresa del tripulante
UPDATE "crew_member_documents" d
SET "document_type_id" = dt.id
FROM "crew_members" cm
JOIN "document_types" dt
  ON dt.business_id = cm.business_id
 AND dt.code = 'WL'
 AND dt.deleted_at IS NULL
WHERE d.crew_member_id = cm.id
  AND d."type" = 'warning_letter'
  AND d."document_type_id" IS NULL;

-- Cualquier resto sin mapear → WL de su empresa (fallback)
UPDATE "crew_member_documents" d
SET "document_type_id" = dt.id
FROM "crew_members" cm
JOIN "document_types" dt
  ON dt.business_id = cm.business_id
 AND dt.code = 'WL'
 AND dt.deleted_at IS NULL
WHERE d.crew_member_id = cm.id
  AND d."document_type_id" IS NULL;

ALTER TABLE "crew_member_documents" ALTER COLUMN "document_type_id" SET NOT NULL;

DROP INDEX IF EXISTS "crew_member_documents_type_idx";
ALTER TABLE "crew_member_documents" DROP COLUMN "type";

CREATE INDEX "crew_member_documents_document_type_id_idx" ON "crew_member_documents"("document_type_id");
CREATE INDEX "crew_member_documents_source_module_idx" ON "crew_member_documents"("source_module");

ALTER TABLE "crew_member_documents"
  ADD CONSTRAINT "crew_member_documents_document_type_id_fkey"
  FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
