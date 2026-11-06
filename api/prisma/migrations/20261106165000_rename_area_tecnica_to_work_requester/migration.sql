-- Renombra el rol de sistema Área Técnica → Solicitante de trabajos (work_requester).
-- Preset: el poder de pedir avisos sigue siendo work_notices.* + User.areaId.

UPDATE "roles"
SET
  "key" = 'work_requester',
  "name" = 'Solicitante de trabajos',
  "description" = 'Crea avisos de trabajo desde su área (User.areaId). Ve contratistas, habilitaciones y permisos en solo lectura.',
  "updated_at" = NOW()
WHERE "key" = 'area_tecnica'
  AND "deleted_at" IS NULL;

-- Alinea internal_rol de usuarios que aún tengan el key viejo.
UPDATE "users"
SET
  "internal_rol" = 'work_requester',
  "updated_at" = NOW()
WHERE "internal_rol" = 'area_tecnica';
