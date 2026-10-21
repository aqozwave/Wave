import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  BusinessResponse,
  CreateBusinessBody,
  ListBusinessesQuery,
} from "./businesses.schemas.js";

/** Actor mínimo para reglas de tenant (viene de req.user). */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

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
 */
export async function createBusiness(
  body: CreateBusinessBody,
): Promise<BusinessResponse> {
  try {
    const row = await prisma.business.create({
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
    return toBusinessResponse(row);
  } catch (err) {
    // Unique parcial de name o legacy_mongo_id.
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
