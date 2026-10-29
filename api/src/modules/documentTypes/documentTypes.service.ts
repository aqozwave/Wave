import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateDocumentTypeBody,
  DocumentTypeResponse,
  ListDocumentTypesQuery,
  UpdateDocumentTypeBody,
} from "./documentTypes.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/**
 * Mantener visibility legacy alineada a crewCanView
 * para clientes / listados que aún leen ese campo.
 */
function visibilityFromCrewCanView(crewCanView: boolean): string {
  return crewCanView ? "employee" : "supervisor";
}

/** Serializa fila → contrato. */
function toResponse(row: {
  id: string;
  legacyMongoId: string | null;
  code: string;
  name: string;
  subtype: string;
  appliesTo: string;
  requiresExpiry: boolean;
  uploadBy: string;
  viewBy: string;
  crewCanView: boolean;
  visibility: string;
  businessId: string;
  state: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentTypeResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    code: row.code,
    name: row.name,
    subtype: row.subtype,
    appliesTo: row.appliesTo,
    requiresExpiry: row.requiresExpiry,
    uploadBy: row.uploadBy,
    viewBy: row.viewBy,
    crewCanView: row.crewCanView,
    visibility: row.visibility,
    businessId: row.businessId,
    state: row.state,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Scope listado por tenant + filtros. */
function listWhere(
  actor: Actor,
  query: ListDocumentTypesQuery,
): Prisma.DocumentTypeWhereInput {
  const base: Prisma.DocumentTypeWhereInput = { deletedAt: null };

  if (actor.internalRol === "superadmin") {
    if (query.businessId) base.businessId = query.businessId;
  } else {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    base.businessId = actor.businessId;
  }

  if (query.subtype) base.subtype = query.subtype;
  if (query.appliesTo) base.appliesTo = query.appliesTo;
  if (query.search?.trim()) {
    const q = query.search.trim();
    base.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  return base;
}

/** businessId de alta. */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateDocumentTypeBody,
): string {
  if (actor.internalRol === "admin") {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    return actor.businessId;
  }
  if (!body.businessId) {
    throw new AppError(
      400,
      "validation_error",
      "businessId es requerido para crear un tipo de documento",
    );
  }
  return body.businessId;
}

/** 404 si no ve la empresa. */
function assertTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "document_type_not_found",
      "Tipo de documento no encontrado",
    );
  }
}

/** Listado paginado. */
export async function listDocumentTypes(
  actor: Actor,
  query: ListDocumentTypesQuery,
): Promise<{
  items: DocumentTypeResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const [rows, total] = await Promise.all([
    prisma.documentType.findMany({
      where,
      orderBy: [{ code: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.documentType.count({ where }),
  ]);
  return {
    items: rows.map(toResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id. */
export async function getDocumentTypeById(
  actor: Actor,
  id: string,
): Promise<DocumentTypeResponse> {
  const row = await prisma.documentType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "document_type_not_found",
      "Tipo de documento no encontrado",
    );
  }
  assertTenantAccess(actor, row.businessId);
  return toResponse(row);
}

/** Alta. */
export async function createDocumentType(
  actor: Actor,
  body: CreateDocumentTypeBody,
): Promise<DocumentTypeResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  const crewCanView = body.crewCanView ?? true;
  const visibility =
    body.visibility ?? visibilityFromCrewCanView(crewCanView);

  try {
    const row = await prisma.documentType.create({
      data: {
        code: body.code,
        name: body.name,
        subtype: body.subtype ?? "general",
        appliesTo: body.appliesTo ?? "crew_and_external",
        requiresExpiry: body.requiresExpiry ?? false,
        uploadBy: body.uploadBy ?? "prevention_or_admin",
        viewBy: body.viewBy ?? "prevention_or_admin",
        crewCanView,
        visibility,
        businessId,
        state: body.state ?? true,
      },
    });
    return toResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_document_type_code",
        "Ya existe un tipo con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/** PATCH. */
export async function updateDocumentType(
  actor: Actor,
  id: string,
  payload: UpdateDocumentTypeBody,
): Promise<DocumentTypeResponse> {
  const existing = await prisma.documentType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "document_type_not_found",
      "Tipo de documento no encontrado",
    );
  }
  assertTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (actor.internalRol === "admin" && payload.businessId !== actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover el tipo a otra empresa",
      );
    }
    const business = await prisma.business.findFirst({
      where: { id: payload.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "business_not_found", "Empresa no encontrada");
    }
    nextBusinessId = payload.businessId;
  }

  const data: Prisma.DocumentTypeUpdateInput = {};
  if (payload.code !== undefined) data.code = payload.code;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.subtype !== undefined) data.subtype = payload.subtype;
  if (payload.appliesTo !== undefined) data.appliesTo = payload.appliesTo;
  if (payload.requiresExpiry !== undefined) {
    data.requiresExpiry = payload.requiresExpiry;
  }
  if (payload.uploadBy !== undefined) data.uploadBy = payload.uploadBy;
  if (payload.viewBy !== undefined) data.viewBy = payload.viewBy;
  if (payload.crewCanView !== undefined) {
    data.crewCanView = payload.crewCanView;
    if (payload.visibility === undefined) {
      data.visibility = visibilityFromCrewCanView(payload.crewCanView);
    }
  }
  if (payload.visibility !== undefined) data.visibility = payload.visibility;
  if (payload.state !== undefined) data.state = payload.state;
  if (nextBusinessId !== existing.businessId) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.documentType.update({
      where: { id },
      data,
    });
    return toResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_document_type_code",
        "Ya existe un tipo con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/** Soft delete. */
export async function deleteDocumentType(
  actor: Actor,
  id: string,
): Promise<DocumentTypeResponse> {
  const existing = await prisma.documentType.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "document_type_not_found",
      "Tipo de documento no encontrado",
    );
  }
  assertTenantAccess(actor, existing.businessId);

  const updated = await prisma.documentType.update({
    where: { id },
    data: { deletedAt: new Date(), state: false },
  });
  return toResponse(updated);
}
