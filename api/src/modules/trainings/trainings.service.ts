import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateTrainingBody,
  ListTrainingsQuery,
  TrainingResponse,
  UpdateTrainingBody,
} from "./trainings.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Serializa fila Prisma → contrato Zod. */
function toTrainingResponse(row: {
  id: string;
  businessId: string;
  code: string;
  name: string;
  validityMonths: number | null;
  appliesTo: string[];
  documentTypeId: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  documentType: { id: string; code: string; name: string } | null;
}): TrainingResponse {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    name: row.name,
    validityMonths: row.validityMonths,
    appliesTo: row.appliesTo as TrainingResponse["appliesTo"],
    documentTypeId: row.documentTypeId,
    documentType: row.documentType,
    active: row.active,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Include de documentType en lecturas. */
const documentTypeInclude = {
  documentType: { select: { id: true, code: true, name: true } },
} as const;

/**
 * Filtro de listado: superadmin ve todas (o filtra businessId);
 * resto solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListTrainingsQuery,
): Prisma.TrainingWhereInput {
  const base: Prisma.TrainingWhereInput = { deletedAt: null };

  if (query.active !== undefined) {
    base.active = query.active;
  }

  if (query.search && query.search.length > 0) {
    base.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { name: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (actor.internalRol === "superadmin") {
    if (query.businessId) {
      return { ...base, businessId: query.businessId };
    }
    return base;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  return { ...base, businessId: actor.businessId };
}

/** 404 genérico si el actor no puede ver esa empresa. */
function assertTrainingTenantAccess(
  actor: Actor,
  trainingBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== trainingBusinessId) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateTrainingBody,
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
      "businessId es requerido para crear una capacitación",
    );
  }
  return body.businessId;
}

/**
 * Valida documentTypeId opcional: existe, misma empresa, no borrado.
 * null limpia el vínculo.
 */
async function assertDocumentTypeForBusiness(
  businessId: string,
  documentTypeId: string | null | undefined,
): Promise<string | null | undefined> {
  if (documentTypeId === undefined) return undefined;
  if (documentTypeId === null) return null;

  const doc = await prisma.documentType.findFirst({
    where: { id: documentTypeId, deletedAt: null },
  });
  if (!doc || doc.businessId !== businessId) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo de documento no encontrado en esta empresa",
    );
  }
  return documentTypeId;
}

/** Lista capacitaciones visibles (paginado). */
export async function listTrainings(
  actor: Actor,
  query: ListTrainingsQuery,
): Promise<{
  items: TrainingResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.training.findMany({
      where,
      include: documentTypeInclude,
      orderBy: [{ code: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.training.count({ where }),
  ]);

  return {
    items: rows.map(toTrainingResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id. */
export async function getTrainingById(
  actor: Actor,
  id: string,
): Promise<TrainingResponse> {
  const row = await prisma.training.findFirst({
    where: { id, deletedAt: null },
    include: documentTypeInclude,
  });
  if (!row) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  assertTrainingTenantAccess(actor, row.businessId);
  return toTrainingResponse(row);
}

/** Alta de capacitación (catálogo P1). */
export async function createTraining(
  actor: Actor,
  body: CreateTrainingBody,
): Promise<TrainingResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  const documentTypeId = await assertDocumentTypeForBusiness(
    businessId,
    body.documentTypeId ?? null,
  );

  try {
    const row = await prisma.training.create({
      data: {
        businessId,
        code: body.code,
        name: body.name,
        validityMonths: body.validityMonths ?? null,
        appliesTo: body.appliesTo ?? [],
        documentTypeId: documentTypeId ?? null,
        active: body.active ?? true,
      },
      include: documentTypeInclude,
    });
    return toTrainingResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_training_code",
        "Ya existe una capacitación con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/** PATCH de capacitación (datos / active). */
export async function updateTraining(
  actor: Actor,
  id: string,
  payload: UpdateTrainingBody,
): Promise<TrainingResponse> {
  const existing = await prisma.training.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  assertTrainingTenantAccess(actor, existing.businessId);

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (
      actor.internalRol === "admin" &&
      payload.businessId !== actor.businessId
    ) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover la capacitación a otra empresa",
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

  const documentTypeId = await assertDocumentTypeForBusiness(
    nextBusinessId,
    payload.documentTypeId,
  );

  const data: Prisma.TrainingUpdateInput = {};
  if (payload.code !== undefined) data.code = payload.code;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.validityMonths !== undefined) {
    data.validityMonths = payload.validityMonths;
  }
  if (payload.appliesTo !== undefined) data.appliesTo = payload.appliesTo;
  if (payload.active !== undefined) data.active = payload.active;
  if (documentTypeId !== undefined) {
    data.documentType =
      documentTypeId === null
        ? { disconnect: true }
        : { connect: { id: documentTypeId } };
  }
  if (payload.businessId !== undefined) {
    data.business = { connect: { id: payload.businessId } };
  }

  try {
    const updated = await prisma.training.update({
      where: { id },
      data,
      include: documentTypeInclude,
    });
    return toTrainingResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_training_code",
        "Ya existe una capacitación con ese código en esta empresa",
      );
    }
    throw err;
  }
}

/**
 * Soft delete: deletedAt + active=false.
 * No desvincula exigencias de permiso que apunten a ella.
 */
export async function deleteTraining(
  actor: Actor,
  id: string,
): Promise<TrainingResponse> {
  const existing = await prisma.training.findFirst({
    where: { id, deletedAt: null },
    include: documentTypeInclude,
  });
  if (!existing) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  assertTrainingTenantAccess(actor, existing.businessId);

  const updated = await prisma.training.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
    include: documentTypeInclude,
  });
  return toTrainingResponse(updated);
}
