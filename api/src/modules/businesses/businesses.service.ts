import { Prisma } from "@prisma/client";
import { DOCUMENT_TYPE_SEED } from "../../lib/documentTypeSeed.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  BusinessResponse,
  CreateBusinessBody,
  ListBusinessesQuery,
  UpdateBusinessBody,
} from "./businesses.schemas.js";

/** Actor mínimo para reglas de tenant (viene de req.user). */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Campos clave: solo superadmin (opción A). */
const PROTECTED_FIELDS = ["rut", "name", "state"] as const;

/** Contacto: admin y superadmin. */
const ADMIN_EDITABLE_FIELDS = [
  "giro",
  "country",
  "commune",
  "city",
  "phone",
  "email",
  "description",
] as const;

/** Serializa Date → ISO para el contrato Zod. */
function toBusinessResponse(row: {
  id: string;
  legacyMongoId: string | null;
  rut: string | null;
  name: string;
  giro: string | null;
  country: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): BusinessResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    rut: row.rut,
    name: row.name,
    giro: row.giro,
    country: row.country,
    commune: row.commune,
    city: row.city,
    phone: row.phone,
    email: row.email,
    description: row.description,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Filtro de listado según rol (opción A / portal viejo).
 * Superadmin: todas no borradas. Admin/user: solo su empresa.
 */
function listWhere(actor: Actor): Prisma.BusinessWhereInput {
  const base: Prisma.BusinessWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    return base;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  return { ...base, id: actor.businessId };
}

/**
 * Superadmin: cualquier id. Admin/user: solo su businessId.
 * 404 genérico si no tiene acceso (no filtrar existencia a otra empresa).
 */
function assertBusinessTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") {
    return;
  }

  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(404, "business_not_found", "Empresa no encontrada");
  }
}

/**
 * Lista empresas visibles para el actor (paginado).
 */
export async function listBusinesses(
  actor: Actor,
  query: ListBusinessesQuery,
): Promise<{
  items: BusinessResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor);
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await prisma.$transaction([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toBusinessResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * Crea una empresa (solo superadmin a nivel de ruta).
 * Nombre único entre no borradas (índice parcial en BD).
 * Siembra el catálogo inicial de tipos de documento (códigos HR).
 */
export async function createBusiness(
  body: CreateBusinessBody,
): Promise<BusinessResponse> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          rut: body.rut ?? null,
          name: body.name,
          giro: body.giro ?? null,
          country: body.country ?? "Chile",
          commune: body.commune ?? null,
          city: body.city ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          description: body.description ?? null,
          state: body.state ?? true,
        },
      });
      await tx.documentType.createMany({
        data: DOCUMENT_TYPE_SEED.map((seed) => ({
          code: seed.code,
          name: seed.name,
          subtype: seed.subtype,
          visibility: seed.visibility,
          businessId: business.id,
          state: true,
        })),
      });
      return business;
    });
    return toBusinessResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_business_name",
        "El nombre de la empresa ya existe",
      );
    }
    throw err;
  }
}

/**
 * Detalle por id (tenant-aware).
 */
export async function getBusinessById(
  actor: Actor,
  id: string,
): Promise<BusinessResponse> {
  assertBusinessTenantAccess(actor, id);

  const row = await prisma.business.findFirst({
    where: { id, deletedAt: null },
  });

  if (!row) {
    throw new AppError(404, "business_not_found", "Empresa no encontrada");
  }

  return toBusinessResponse(row);
}

/**
 * Recorta el body según rol (opción A).
 * Admin no puede tocar rut/name/state.
 */
function sanitizeUpdatePayload(
  actor: Actor,
  payload: UpdateBusinessBody,
): Prisma.BusinessUpdateInput {
  if (actor.internalRol === "superadmin") {
    const data: Prisma.BusinessUpdateInput = {};
    if (payload.rut !== undefined) data.rut = payload.rut ?? null;
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.giro !== undefined) data.giro = payload.giro ?? null;
    if (payload.country !== undefined) data.country = payload.country ?? null;
    if (payload.commune !== undefined) data.commune = payload.commune ?? null;
    if (payload.city !== undefined) data.city = payload.city ?? null;
    if (payload.phone !== undefined) data.phone = payload.phone ?? null;
    if (payload.email !== undefined) data.email = payload.email ?? null;
    if (payload.description !== undefined) {
      data.description = payload.description ?? null;
    }
    if (payload.state !== undefined) data.state = payload.state;
    return data;
  }

  // Admin (u otro no-superadmin con acceso tenant): solo contacto.
  if (actor.internalRol !== "admin") {
    throw new AppError(403, "forbidden", "No podés editar esta empresa");
  }

  const attemptedProtected = PROTECTED_FIELDS.filter(
    (key) => payload[key] !== undefined,
  );
  if (attemptedProtected.length > 0) {
    throw new AppError(
      403,
      "forbidden",
      "No puedes modificar RUT, nombre ni estado de la empresa",
    );
  }

  const data: Prisma.BusinessUpdateInput = {};
  for (const key of ADMIN_EDITABLE_FIELDS) {
    if (payload[key] !== undefined) {
      data[key] = payload[key] ?? null;
    }
  }

  if (Object.keys(data).length === 0) {
    throw new AppError(
      400,
      "validation_error",
      "No hay campos permitidos para actualizar",
    );
  }

  return data;
}

/**
 * Actualiza empresa (PATCH). Superadmin: todo; admin: contacto.
 */
export async function updateBusiness(
  actor: Actor,
  id: string,
  payload: UpdateBusinessBody,
): Promise<BusinessResponse> {
  assertBusinessTenantAccess(actor, id);
  const data = sanitizeUpdatePayload(actor, payload);

  const existing = await prisma.business.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "business_not_found", "Empresa no encontrada");
  }

  try {
    const updated = await prisma.business.update({
      where: { id },
      data,
    });
    return toBusinessResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_business_name",
        "El nombre de la empresa ya existe",
      );
    }
    throw err;
  }
}

/**
 * Soft delete: deletedAt + state=false. Solo superadmin (ruta).
 * Bloquea si hay usuarios activos de esa empresa (locations llegan en S3).
 */
export async function deleteBusinessById(
  id: string,
): Promise<BusinessResponse> {
  const business = await prisma.business.findFirst({
    where: { id, deletedAt: null },
  });

  if (!business) {
    throw new AppError(404, "business_not_found", "Empresa no encontrada");
  }

  const activeUsers = await prisma.user.count({
    where: {
      businessId: id,
      deletedAt: null,
      state: true,
    },
  });

  if (activeUsers > 0) {
    throw new AppError(
      409,
      "business_has_dependents",
      `No se puede eliminar la empresa: tiene ${activeUsers} usuario(s) activo(s)`,
    );
  }

  const updated = await prisma.business.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      state: false,
    },
  });

  return toBusinessResponse(updated);
}
