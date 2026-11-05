import { Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  ContractorOrganizationResponse,
  CreateContractorBody,
  ListContractorsQuery,
  UpdateContractorBody,
} from "./contractors.schemas.js";

/** Actor mínimo para reglas de tenant. */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** HAB más reciente incluida en lecturas de org. */
type LatestAccreditationRow = {
  id: string;
  code: string;
  status:
    | "invited"
    | "pending"
    | "in_review"
    | "observed"
    | "approved"
    | "rejected";
  requestedAt: Date | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
};

/** Serializa fila Prisma → contrato Zod. */
function toContractorResponse(row: {
  id: string;
  businessId: string;
  name: string;
  rut: string;
  role: "permanent" | "occasional";
  specialty: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  legalRepresentative: string | null;
  address: string | null;
  mutual: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  prevencionistName: string | null;
  prevencionistEmail: string | null;
  subcontractors: string | null;
  workDescription: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  accreditations?: LatestAccreditationRow[];
}): ContractorOrganizationResponse {
  const latest = row.accreditations?.[0] ?? null;
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    rut: row.rut,
    role: row.role,
    specialty: row.specialty,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    legalRepresentative: row.legalRepresentative,
    address: row.address,
    mutual: row.mutual,
    supervisorName: row.supervisorName,
    supervisorEmail: row.supervisorEmail,
    prevencionistName: row.prevencionistName,
    prevencionistEmail: row.prevencionistEmail,
    subcontractors: row.subcontractors,
    workDescription: row.workDescription,
    active: row.active,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestAccreditation: latest
      ? {
          id: latest.id,
          code: latest.code,
          status: latest.status,
          requestedAt: latest.requestedAt
            ? latest.requestedAt.toISOString()
            : null,
          submittedAt: latest.submittedAt
            ? latest.submittedAt.toISOString()
            : null,
          reviewedAt: latest.reviewedAt
            ? latest.reviewedAt.toISOString()
            : null,
        }
      : null,
    /** Hasta existir contractor_people. */
    personCount: 0,
  };
}

/** Include HAB más reciente (1) por createdAt desc. */
const latestAccreditationInclude = {
  accreditations: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      code: true,
      status: true,
      requestedAt: true,
      submittedAt: true,
      reviewedAt: true,
    },
  },
} as const;

/**
 * Filtro de listado: superadmin ve todas (o filtra businessId);
 * resto solo las de su empresa.
 */
function listWhere(
  actor: Actor,
  query: ListContractorsQuery,
): Prisma.ContractorOrganizationWhereInput {
  const base: Prisma.ContractorOrganizationWhereInput = { deletedAt: null };

  if (query.active !== undefined) {
    base.active = query.active;
  }
  if (query.role) {
    base.role = query.role;
  }
  if (query.accreditationStatus === "none") {
    base.accreditations = { none: {} };
  } else if (query.accreditationStatus) {
    // Tiene al menos una HAB en ese estado (aprox. filtro Figma).
    base.accreditations = { some: { status: query.accreditationStatus } };
  }
  if (query.search && query.search.length > 0) {
    base.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { rut: { contains: query.search, mode: "insensitive" } },
      { contactName: { contains: query.search, mode: "insensitive" } },
      { specialty: { contains: query.search, mode: "insensitive" } },
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
function assertContractorTenantAccess(
  actor: Actor,
  orgBusinessId: string,
): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== orgBusinessId) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }
}

/**
 * Resuelve businessId de creación: admin → su empresa;
 * superadmin → body.businessId obligatorio.
 */
function resolveCreateBusinessId(
  actor: Actor,
  body: CreateContractorBody,
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
      "businessId es requerido para crear una organización contratista",
    );
  }
  return body.businessId;
}

/** Nombre de org en minúsculas (mismo criterio que Business.name). */
function normalizeOrgName(name: string): string {
  return name.trim().toLowerCase();
}

/** Lista organizaciones visibles (paginado). */
export async function listContractors(
  actor: Actor,
  query: ListContractorsQuery,
): Promise<{
  items: ContractorOrganizationResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.contractorOrganization.findMany({
      where,
      include: latestAccreditationInclude,
      orderBy: [{ name: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.contractorOrganization.count({ where }),
  ]);

  return {
    items: rows.map(toContractorResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id. */
export async function getContractorById(
  actor: Actor,
  id: string,
): Promise<ContractorOrganizationResponse> {
  const row = await prisma.contractorOrganization.findFirst({
    where: { id, deletedAt: null },
    include: latestAccreditationInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }
  assertContractorTenantAccess(actor, row.businessId);
  return toContractorResponse(row);
}

/** Alta de organización contratista (P2). */
export async function createContractor(
  actor: Actor,
  body: CreateContractorBody,
): Promise<ContractorOrganizationResponse> {
  const businessId = resolveCreateBusinessId(actor, body);
  await assertBusinessModuleEnabled(businessId, "contractors");

  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });
  if (!business) {
    throw new AppError(400, "business_not_found", "Empresa no encontrada");
  }

  try {
    const row = await prisma.contractorOrganization.create({
      data: {
        businessId,
        name: normalizeOrgName(body.name),
        rut: body.rut,
        role: body.role,
        specialty: body.specialty ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        legalRepresentative: body.legalRepresentative ?? null,
        address: body.address ?? null,
        mutual: body.mutual ?? null,
        supervisorName: body.supervisorName ?? null,
        supervisorEmail: body.supervisorEmail ?? null,
        prevencionistName: body.prevencionistName ?? null,
        prevencionistEmail: body.prevencionistEmail ?? null,
        subcontractors: body.subcontractors ?? null,
        workDescription: body.workDescription ?? null,
        active: body.active ?? true,
      },
      include: latestAccreditationInclude,
    });
    return toContractorResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_contractor_rut",
        "Ya existe una organización con ese RUT en esta empresa",
      );
    }
    throw err;
  }
}

/** PATCH de organización (datos / active). */
export async function updateContractor(
  actor: Actor,
  id: string,
  payload: UpdateContractorBody,
): Promise<ContractorOrganizationResponse> {
  const existing = await prisma.contractorOrganization.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }
  assertContractorTenantAccess(actor, existing.businessId);
  await assertBusinessModuleEnabled(existing.businessId, "contractors");

  let nextBusinessId = existing.businessId;
  if (payload.businessId !== undefined) {
    if (
      actor.internalRol === "admin" &&
      payload.businessId !== actor.businessId
    ) {
      throw new AppError(
        403,
        "forbidden",
        "No puedes mover la organización a otra empresa",
      );
    }
    const business = await prisma.business.findFirst({
      where: { id: payload.businessId, deletedAt: null },
    });
    if (!business) {
      throw new AppError(400, "business_not_found", "Empresa no encontrada");
    }
    await assertBusinessModuleEnabled(payload.businessId, "contractors");
    nextBusinessId = payload.businessId;
  }

  const data: Prisma.ContractorOrganizationUpdateInput = {};
  if (payload.name !== undefined) data.name = normalizeOrgName(payload.name);
  if (payload.rut !== undefined) data.rut = payload.rut;
  if (payload.role !== undefined) data.role = payload.role;
  if (payload.specialty !== undefined) data.specialty = payload.specialty ?? null;
  if (payload.contactName !== undefined) {
    data.contactName = payload.contactName ?? null;
  }
  if (payload.contactEmail !== undefined) {
    data.contactEmail = payload.contactEmail ?? null;
  }
  if (payload.contactPhone !== undefined) {
    data.contactPhone = payload.contactPhone ?? null;
  }
  if (payload.legalRepresentative !== undefined) {
    data.legalRepresentative = payload.legalRepresentative ?? null;
  }
  if (payload.address !== undefined) data.address = payload.address ?? null;
  if (payload.mutual !== undefined) data.mutual = payload.mutual ?? null;
  if (payload.supervisorName !== undefined) {
    data.supervisorName = payload.supervisorName ?? null;
  }
  if (payload.supervisorEmail !== undefined) {
    data.supervisorEmail = payload.supervisorEmail ?? null;
  }
  if (payload.prevencionistName !== undefined) {
    data.prevencionistName = payload.prevencionistName ?? null;
  }
  if (payload.prevencionistEmail !== undefined) {
    data.prevencionistEmail = payload.prevencionistEmail ?? null;
  }
  if (payload.subcontractors !== undefined) {
    data.subcontractors = payload.subcontractors ?? null;
  }
  if (payload.workDescription !== undefined) {
    data.workDescription = payload.workDescription ?? null;
  }
  if (payload.active !== undefined) data.active = payload.active;
  if (payload.businessId !== undefined) {
    data.business = { connect: { id: nextBusinessId } };
  }

  try {
    const updated = await prisma.contractorOrganization.update({
      where: { id },
      data,
      include: latestAccreditationInclude,
    });
    return toContractorResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_contractor_rut",
        "Ya existe una organización con ese RUT en esta empresa",
      );
    }
    throw err;
  }
}

/** Soft delete: deletedAt + active=false. */
export async function deleteContractor(
  actor: Actor,
  id: string,
): Promise<ContractorOrganizationResponse> {
  const existing = await prisma.contractorOrganization.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }
  assertContractorTenantAccess(actor, existing.businessId);
  await assertBusinessModuleEnabled(existing.businessId, "contractors");

  const updated = await prisma.contractorOrganization.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
    include: latestAccreditationInclude,
  });
  return toContractorResponse(updated);
}
