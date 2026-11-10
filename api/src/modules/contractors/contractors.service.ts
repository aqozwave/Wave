import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import { AppError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { requestPasswordReset } from "../auth/auth.service.js";
import {
  createAccreditationDocument,
  createAccreditationPersonDocument,
  listAccreditationDocuments,
  listAccreditationPersonDocuments,
  resolveAccreditationDocumentFile,
  resolveAccreditationPersonDocumentFile,
} from "../accreditationDocuments/accreditationDocuments.service.js";
import type {
  ContractorOrgDocumentResponse,
  ContractorPersonDocumentResponse,
} from "../accreditationDocuments/accreditationDocuments.schemas.js";
import type { AccreditationResponse } from "../accreditations/accreditations.schemas.js";
import {
  clearAdditionalDocsRequestIfFulfilled,
  submitAccreditation,
} from "../accreditations/accreditations.service.js";
import type {
  ContractorOrganizationResponse,
  ContractorPersonResponse,
  ContractorPortalPersonResponse,
  ContractorPortalSummaryResponse,
  ContractorUserResponse,
  CreateContractorBody,
  CreateContractorPersonBody,
  CreateContractorPortalDocumentBody,
  InviteContractorUserBody,
  ListContractorPeopleQuery,
  ListContractorUsersQuery,
  ListContractorsQuery,
  UpdateContractorBody,
  UpdateContractorPersonBody,
  UpdateMyContractorOrganizationBody,
} from "./contractors.schemas.js";

/** Actor mínimo para reglas de tenant (+ id para invitedBy). */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

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
  _count?: { people: number };
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
    personCount: row._count?.people ?? 0,
  };
}

/** Include HAB más reciente (1) + conteo de personal activo. */
const latestAccreditationInclude = {
  accreditations: {
    where: { deletedAt: null },
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
  _count: {
    select: {
      people: { where: { deletedAt: null } },
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

/** Include de quien invitó (listado / invite). */
const invitedByInclude = {
  invitedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

/** Serializa usuario de org (P9b) con Invitado por. */
function toContractorUserResponse(row: {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  run: string;
  confirmed: boolean;
  state: boolean;
  internalRol: string;
  lastLoginAt: Date | null;
  accessExpiresAt: Date | null;
  createdAt: Date;
  invitedBy: { id: string; firstName: string; lastName: string } | null;
}): ContractorUserResponse {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.firstName,
    lastName: row.lastName,
    run: row.run,
    confirmed: row.confirmed,
    invitePending: !row.confirmed,
    state: row.state,
    internalRol: row.internalRol,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    accessExpiresAt: row.accessExpiresAt
      ? row.accessExpiresAt.toISOString()
      : null,
    createdAt: row.createdAt.toISOString(),
    invitedBy: row.invitedBy
      ? {
          id: row.invitedBy.id,
          firstName: row.invitedBy.firstName,
          lastName: row.invitedBy.lastName,
        }
      : null,
  };
}

/** Carga org activa con chequeo de tenant; 404 si no existe o sin acceso. */
async function loadOrgForUsers(
  actor: Actor,
  organizationId: string,
): Promise<{ id: string; businessId: string; active: boolean }> {
  const org = await prisma.contractorOrganization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, businessId: true, active: true },
  });
  if (!org) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }
  assertContractorTenantAccess(actor, org.businessId);
  return org;
}

/**
 * Username a partir del local-part del email; asegura unicidad con sufijo.
 * Mismo criterio que Acceso de tripulante (D45).
 */
async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const local = email.split("@")[0] ?? "user";
  const base =
    local
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 24) || "user";

  for (let i = 0; i < 8; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await prisma.user.findFirst({
      where: { username: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}${randomBytes(3).toString("hex")}`;
}

/** Contraseña temporal fuerte; el invitado la cambia con el enlace. */
function generateInvitePassword(): string {
  return `Wave${randomBytes(9).toString("hex")}9a`;
}

/**
 * Rol de sistema `contratista` para invitados del portal externo.
 * Incluye work_permits + accreditations (no el rol `user` de tripulante).
 */
async function resolveContractorInviteRole() {
  const role = await prisma.role.findFirst({
    where: { key: "contratista", deletedAt: null, state: true },
  });
  if (!role) {
    throw new AppError(
      500,
      "role_missing",
      'Rol de sistema "contratista" no encontrado',
    );
  }
  return role;
}

/** GET /contractors/:id/users — listado de invitados de la org. */
export async function listContractorUsers(
  actor: Actor,
  organizationId: string,
  query: ListContractorUsersQuery,
): Promise<{
  items: ContractorUserResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  await loadOrgForUsers(actor, organizationId);

  const where = {
    organizationId,
    deletedAt: null,
  };
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: invitedByInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: rows.map(toContractorUserResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * POST /contractors/:id/users — invita o vincula (P9b).
 * - Email nuevo → crea usuario confirmed=false + reset.
 * - Email del mismo tenant sin org → vincula a esta org.
 * - Ya en esta org → reenvía reset si no confirmó.
 */
export async function inviteContractorUser(
  actor: Actor,
  organizationId: string,
  body: InviteContractorUserBody,
): Promise<ContractorUserResponse> {
  const org = await loadOrgForUsers(actor, organizationId);
  if (!org.active) {
    throw new AppError(
      400,
      "contractor_inactive",
      "La organización está inactiva; no se pueden invitar usuarios",
    );
  }
  await assertBusinessModuleEnabled(org.businessId, "contractors");

  const role = await resolveContractorInviteRole();
  const email = body.email.trim().toLowerCase();
  const accessExpiresAt =
    body.accessExpiresAt === undefined
      ? undefined
      : body.accessExpiresAt
        ? new Date(body.accessExpiresAt)
        : null;

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existing) {
    // Otro tenant → no se reutiliza.
    if (
      existing.businessId &&
      existing.businessId !== org.businessId
    ) {
      throw new AppError(
        409,
        "email_other_business",
        "Ese email ya pertenece a otra empresa",
      );
    }
    // Ya ligado a otra org contratista.
    if (
      existing.organizationId &&
      existing.organizationId !== org.id
    ) {
      throw new AppError(
        409,
        "user_other_organization",
        "Ese usuario ya está vinculado a otra organización contratista",
      );
    }
    // Tripulante interno: no convertir en externo.
    const crew = await prisma.crewMember.findFirst({
      where: { userId: existing.id, deletedAt: null },
      select: { id: true },
    });
    if (crew) {
      throw new AppError(
        409,
        "user_is_crew",
        "Ese email ya está vinculado a un tripulante",
      );
    }

    // No pisa RUN de una cuenta ya existente (evita choque con unique).
    // Siempre deja rol contratista: el portal necesita work_permits/accreditations.
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        organizationId: org.id,
        businessId: existing.businessId ?? org.businessId,
        firstName: body.firstName,
        lastName: body.lastName,
        invitedById: actor.id,
        roleId: role.id,
        internalRol: role.key,
        ...(accessExpiresAt !== undefined
          ? { accessExpiresAt }
          : {}),
      },
      include: invitedByInclude,
    });

    if (!updated.confirmed) {
      await requestPasswordReset(updated.email);
    }

    return toContractorUserResponse(updated);
  }

  // Alta nueva: RUN no puede estar ya en users.
  const runTaken = await prisma.user.findFirst({
    where: { run: body.run, deletedAt: null },
    select: { id: true },
  });
  if (runTaken) {
    throw new AppError(
      409,
      "duplicate_run",
      "Ya existe un usuario con ese RUN",
    );
  }

  const username = await uniqueUsernameFromEmail(email);
  const passwordHash = await hashPassword(generateInvitePassword());

  try {
    const created = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        run: body.run,
        confirmed: false,
        state: true,
        internalRol: role.key,
        roleId: role.id,
        businessId: org.businessId,
        organizationId: org.id,
        invitedById: actor.id,
        ...(accessExpiresAt !== undefined
          ? { accessExpiresAt }
          : {}),
      },
      include: invitedByInclude,
    });

    await requestPasswordReset(created.email);
    return toContractorUserResponse(created);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_identity",
        "Email, usuario o RUN ya registrado",
      );
    }
    throw err;
  }
}

/** Serializa persona externa → contrato Zod. */
function toContractorPersonResponse(row: {
  id: string;
  organizationId: string;
  rut: string;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ContractorPersonResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    rut: row.rut,
    fullName: row.fullName,
    position: row.position,
    email: row.email,
    phone: row.phone,
    emergencyContact: row.emergencyContact,
    active: row.active,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** GET /contractors/:id/people — personal de la org. */
export async function listContractorPeople(
  actor: Actor,
  organizationId: string,
  query: ListContractorPeopleQuery,
): Promise<{
  items: ContractorPersonResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  await loadOrgForUsers(actor, organizationId);

  const where: Prisma.ContractorPersonWhereInput = {
    organizationId,
    deletedAt: null,
  };
  if (query.active !== undefined) {
    where.active = query.active;
  }
  if (query.search && query.search.length > 0) {
    where.OR = [
      { fullName: { contains: query.search, mode: "insensitive" } },
      { rut: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { position: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    prisma.contractorPerson.findMany({
      where,
      orderBy: [{ fullName: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.contractorPerson.count({ where }),
  ]);

  return {
    items: rows.map(toContractorPersonResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * Un trabajador externo no puede ser usuario del portal ni tripulante del tenant.
 * Comparte el mismo RUN = misma persona física → se rechaza el alta/edición.
 */
async function assertPersonRutNotInternalIdentity(
  businessId: string,
  rut: string,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { run: rut, deletedAt: null },
    select: { id: true },
  });
  if (user) {
    throw new AppError(
      409,
      "rut_is_system_user",
      "Ese RUN ya pertenece a un usuario del sistema",
    );
  }

  const crew = await prisma.crewMember.findFirst({
    where: { businessId, run: rut, deletedAt: null },
    select: { id: true },
  });
  if (crew) {
    throw new AppError(
      409,
      "rut_is_crew_member",
      "Ese RUN ya pertenece a un tripulante embarcado",
    );
  }
}

/** POST /contractors/:id/people — alta de persona. */
export async function createContractorPerson(
  actor: Actor,
  organizationId: string,
  body: CreateContractorPersonBody,
): Promise<ContractorPersonResponse> {
  const org = await loadOrgForUsers(actor, organizationId);
  await assertBusinessModuleEnabled(org.businessId, "contractors");
  await assertPersonRutNotInternalIdentity(org.businessId, body.rut);

  try {
    const row = await prisma.contractorPerson.create({
      data: {
        organizationId: org.id,
        rut: body.rut,
        fullName: body.fullName.trim(),
        position: body.position ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        emergencyContact: body.emergencyContact ?? null,
        active: body.active ?? true,
      },
    });
    return toContractorPersonResponse(row);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_person_rut",
        "Ya existe una persona con ese RUN en esta organización",
      );
    }
    throw err;
  }
}

/** Carga persona de la org o 404. */
async function loadPersonInOrg(
  actor: Actor,
  organizationId: string,
  personId: string,
) {
  await loadOrgForUsers(actor, organizationId);
  const row = await prisma.contractorPerson.findFirst({
    where: { id: personId, organizationId, deletedAt: null },
  });
  if (!row) {
    throw new AppError(
      404,
      "contractor_person_not_found",
      "Persona no encontrada",
    );
  }
  return row;
}

/** PATCH /contractors/:id/people/:personId. */
export async function updateContractorPerson(
  actor: Actor,
  organizationId: string,
  personId: string,
  payload: UpdateContractorPersonBody,
): Promise<ContractorPersonResponse> {
  const existing = await loadPersonInOrg(actor, organizationId, personId);
  const org = await loadOrgForUsers(actor, organizationId);
  await assertBusinessModuleEnabled(org.businessId, "contractors");

  // Si cambia el RUN, también debe quedar fuera de users/crew del tenant.
  if (payload.rut !== undefined && payload.rut !== existing.rut) {
    await assertPersonRutNotInternalIdentity(org.businessId, payload.rut);
  }

  const data: Prisma.ContractorPersonUpdateInput = {};
  if (payload.rut !== undefined) data.rut = payload.rut;
  if (payload.fullName !== undefined) data.fullName = payload.fullName.trim();
  if (payload.position !== undefined) data.position = payload.position ?? null;
  if (payload.email !== undefined) data.email = payload.email ?? null;
  if (payload.phone !== undefined) data.phone = payload.phone ?? null;
  if (payload.emergencyContact !== undefined) {
    data.emergencyContact = payload.emergencyContact ?? null;
  }
  if (payload.active !== undefined) data.active = payload.active;

  try {
    const updated = await prisma.contractorPerson.update({
      where: { id: existing.id },
      data,
    });
    return toContractorPersonResponse(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        409,
        "duplicate_person_rut",
        "Ya existe una persona con ese RUN en esta organización",
      );
    }
    throw err;
  }
}

/** DELETE /contractors/:id/people/:personId — soft delete. */
export async function deleteContractorPerson(
  actor: Actor,
  organizationId: string,
  personId: string,
): Promise<ContractorPersonResponse> {
  const existing = await loadPersonInOrg(actor, organizationId, personId);
  const org = await loadOrgForUsers(actor, organizationId);
  await assertBusinessModuleEnabled(org.businessId, "contractors");

  const updated = await prisma.contractorPerson.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), active: false },
  });
  return toContractorPersonResponse(updated);
}

/**
 * Portal E3b: resumen de la org del usuario autenticado.
 * Requiere organizationId en el actor (usuario externo invitado).
 */
export async function getContractorPortalSummary(
  actor: Pick<AuthUser, "id" | "organizationId" | "businessId">,
): Promise<ContractorPortalSummaryResponse> {
  if (!actor.organizationId) {
    throw new AppError(
      403,
      "not_contractor_user",
      "Esta cuenta no pertenece a una organización contratista",
    );
  }

  const org = await prisma.contractorOrganization.findFirst({
    where: { id: actor.organizationId, deletedAt: null },
  });
  if (!org) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }

  const hab = await prisma.contractorAccreditation.findFirst({
    where: { organizationId: org.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  /** Solo obligatorios del pack (opcionales no cuentan para el progreso). */
  const requiredCompanyTypes = await prisma.documentType.count({
    where: {
      businessId: org.businessId,
      accreditationPack: "company",
      accreditationPackRequired: true,
      state: true,
      deletedAt: null,
    },
  });

  let uploadedCompany = 0;
  if (hab) {
    uploadedCompany = await prisma.contractorOrgDocument.count({
      where: {
        accreditationId: hab.id,
        deletedAt: null,
      },
    });
  }

  const peopleTotal = await prisma.contractorPerson.count({
    where: {
      organizationId: org.id,
      deletedAt: null,
      active: true,
    },
  });

  return {
    organization: {
      id: org.id,
      name: org.name,
      rut: org.rut,
      specialty: org.specialty,
      role: org.role,
    },
    accreditation: hab
      ? {
          id: hab.id,
          code: hab.code,
          status: hab.status,
          message: hab.message,
          dueAt: hab.dueAt ? hab.dueAt.toISOString() : null,
          requestedAt: hab.requestedAt
            ? hab.requestedAt.toISOString()
            : null,
          submittedAt: hab.submittedAt
            ? hab.submittedAt.toISOString()
            : null,
          reviewedAt: hab.reviewedAt
            ? hab.reviewedAt.toISOString()
            : null,
        }
      : null,
    companyDocuments: {
      uploaded: uploadedCompany,
      required: requiredCompanyTypes,
    },
    people: { total: peopleTotal },
  };
}

/** Actor portal: debe tener organizationId. */
type PortalActor = Pick<
  AuthUser,
  "id" | "internalRol" | "businessId" | "organizationId"
>;

/** Exige usuario externo con org. */
function requirePortalOrgId(actor: PortalActor): string {
  if (!actor.organizationId) {
    throw new AppError(
      403,
      "not_contractor_user",
      "Esta cuenta no pertenece a una organización contratista",
    );
  }
  return actor.organizationId;
}

/**
 * HAB más reciente de la org del portal (cualquier estado).
 * 404 si no hay ninguna.
 */
export async function getMyContractorAccreditation(
  actor: PortalActor,
): Promise<AccreditationResponse> {
  const organizationId = requirePortalOrgId(actor);
  const orgSelect = {
    id: true,
    name: true,
    rut: true,
    businessId: true,
    deletedAt: true,
  } as const;

  /** Preferir HAB aprobada (habilitada); si no, la más reciente. */
  const approved = await prisma.contractorAccreditation.findFirst({
    where: { organizationId, status: "approved", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { organization: { select: orgSelect } },
  });
  const hab =
    approved ??
    (await prisma.contractorAccreditation.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { organization: { select: orgSelect } },
    }));

  if (!hab || hab.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "No hay habilitación para tu organización",
    );
  }

  // Auto-cura: pedido adicional ya cubierto → no mostrar aviso en el portal.
  const cleared = await clearAdditionalDocsRequestIfFulfilled(hab.id);
  const awaitingAdditionalDocs = cleared ? false : hab.awaitingAdditionalDocs;
  const additionalDocsMessage = cleared ? null : hab.additionalDocsMessage;
  const additionalDocsTypeIds = cleared
    ? []
    : (hab.additionalDocsTypeIds ?? []);

  return {
    id: hab.id,
    code: hab.code,
    organizationId: hab.organizationId,
    organization: {
      id: hab.organization.id,
      name: hab.organization.name,
      rut: hab.organization.rut,
      businessId: hab.organization.businessId,
    },
    status: hab.status,
    message: hab.message,
    reviewNote: hab.reviewNote,
    awaitingAdditionalDocs,
    additionalDocsMessage,
    additionalDocsTypeIds,
    requestedAt: hab.requestedAt ? hab.requestedAt.toISOString() : null,
    requestedById: hab.requestedById,
    dueAt: hab.dueAt ? hab.dueAt.toISOString() : null,
    submittedAt: hab.submittedAt ? hab.submittedAt.toISOString() : null,
    reviewedAt: hab.reviewedAt ? hab.reviewedAt.toISOString() : null,
    reviewedById: hab.reviewedById,
    createdAt: hab.createdAt.toISOString(),
    updatedAt: hab.updatedAt.toISOString(),
  };
}

/** Checklist pack company de la HAB del portal. */
export async function listMyContractorAccreditationDocuments(
  actor: PortalActor,
) {
  const hab = await getMyContractorAccreditation(actor);
  return listAccreditationDocuments(actor, hab.id);
}

/**
 * Contratista sube pack en HAB abierta, o huecos si Prevención pidió adicionales
 * sobre una HAB aprobada (awaitingAdditionalDocs).
 */
function assertPortalMayUploadDocuments(hab: {
  status: string;
  awaitingAdditionalDocs: boolean;
}): void {
  const open =
    hab.status === "pending" ||
    hab.status === "observed" ||
    hab.status === "invited" ||
    hab.status === "in_review";
  const additionalOnApproved =
    hab.status === "approved" && hab.awaitingAdditionalDocs;
  if (!open && !additionalOnApproved) {
    throw new AppError(
      400,
      "accreditation_upload_forbidden",
      "No podés subir documentos ahora. Si Prevención pide adicionales, te habilitará la carga en el portal.",
      { status: hab.status },
    );
  }
}

/** Upload doc empresa desde el portal. */
export async function createMyContractorAccreditationDocument(
  actor: PortalActor,
  body: CreateContractorPortalDocumentBody,
): Promise<ContractorOrgDocumentResponse> {
  const hab = await getMyContractorAccreditation(actor);
  assertPortalMayUploadDocuments(hab);
  return createAccreditationDocument(actor, hab.id, body);
}

/** Resuelve archivo para descarga portal. */
export async function resolveMyContractorAccreditationDocumentFile(
  actor: PortalActor,
  documentId: string,
) {
  const hab = await getMyContractorAccreditation(actor);
  return resolveAccreditationDocumentFile(actor, hab.id, documentId);
}

/** Enviar HAB a revisión desde el portal. */
export async function submitMyContractorAccreditation(
  actor: PortalActor,
): Promise<AccreditationResponse> {
  const hab = await getMyContractorAccreditation(actor);
  return submitAccreditation(actor, hab.id);
}

/**
 * Portal E5: listado de personal de la org del actor + progreso docs pack person.
 */
export async function listMyContractorPeople(
  actor: PortalActor,
  query: ListContractorPeopleQuery,
): Promise<{
  items: ContractorPortalPersonResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const organizationId = requirePortalOrgId(actor);
  const listed = await listContractorPeople(actor, organizationId, query);

  const org = await prisma.contractorOrganization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { businessId: true },
  });
  if (!org) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización contratista no encontrada",
    );
  }

  const packTypes = await prisma.documentType.findMany({
    where: {
      businessId: org.businessId,
      accreditationPack: "person",
      state: true,
      deletedAt: null,
    },
    select: { id: true, accreditationPackRequired: true },
  });
  const packTypeIds = new Set(packTypes.map((t) => t.id));
  /** Solo obligatorios cuentan para “X/Y vig.” en personal. */
  const required = packTypes.filter((t) => t.accreditationPackRequired).length;

  const hab = await prisma.contractorAccreditation.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const personIds = listed.items.map((p) => p.id);
  const uploadedByPerson = new Map<string, number>();
  const observedByPerson = new Map<string, number>();
  const validatedByPerson = new Map<string, number>();

  if (hab && personIds.length > 0) {
    const docs = await prisma.contractorPersonDocument.findMany({
      where: {
        accreditationId: hab.id,
        personId: { in: personIds },
        deletedAt: null,
        status: { not: "replaced" },
        documentTypeId: { in: [...packTypeIds] },
      },
      select: {
        personId: true,
        status: true,
        documentTypeId: true,
        expiresAt: true,
      },
    });
    const now = Date.now();
    /** Un doc vigente por tipo (solo pack person; no cuenta exigencias de faena). */
    const typesByPerson = new Map<string, Set<string>>();
    const observedTypesByPerson = new Map<string, Set<string>>();
    const validatedTypesByPerson = new Map<string, Set<string>>();
    for (const doc of docs) {
      if (!packTypeIds.has(doc.documentTypeId)) continue;
      const set = typesByPerson.get(doc.personId) ?? new Set<string>();
      if (set.has(doc.documentTypeId)) continue;
      set.add(doc.documentTypeId);
      typesByPerson.set(doc.personId, set);
      if (doc.status === "observed") {
        const obs =
          observedTypesByPerson.get(doc.personId) ?? new Set<string>();
        obs.add(doc.documentTypeId);
        observedTypesByPerson.set(doc.personId, obs);
      }
      if (
        doc.status === "validated" &&
        !(doc.expiresAt && doc.expiresAt.getTime() < now)
      ) {
        const val =
          validatedTypesByPerson.get(doc.personId) ?? new Set<string>();
        val.add(doc.documentTypeId);
        validatedTypesByPerson.set(doc.personId, val);
      }
    }
    for (const [pid, set] of typesByPerson) {
      uploadedByPerson.set(pid, set.size);
    }
    for (const [pid, set] of observedTypesByPerson) {
      observedByPerson.set(pid, set.size);
    }
    for (const [pid, set] of validatedTypesByPerson) {
      validatedByPerson.set(pid, set.size);
    }
  }

  return {
    items: listed.items.map((p) => ({
      ...p,
      documents: {
        uploaded: uploadedByPerson.get(p.id) ?? 0,
        required,
        observed: observedByPerson.get(p.id) ?? 0,
        validated: validatedByPerson.get(p.id) ?? 0,
      },
    })),
    total: listed.total,
    page: listed.page,
    limit: listed.limit,
  };
}

/** Portal E5: alta de persona en la org del actor. */
export async function createMyContractorPerson(
  actor: PortalActor,
  body: CreateContractorPersonBody,
): Promise<ContractorPersonResponse> {
  const organizationId = requirePortalOrgId(actor);
  return createContractorPerson(actor, organizationId, body);
}

/** Portal E5: editar persona de la org del actor. */
export async function updateMyContractorPerson(
  actor: PortalActor,
  personId: string,
  body: UpdateContractorPersonBody,
): Promise<ContractorPersonResponse> {
  const organizationId = requirePortalOrgId(actor);
  return updateContractorPerson(actor, organizationId, personId, body);
}

/** Portal E5: soft delete persona de la org del actor. */
export async function deleteMyContractorPerson(
  actor: PortalActor,
  personId: string,
): Promise<ContractorPersonResponse> {
  const organizationId = requirePortalOrgId(actor);
  return deleteContractorPerson(actor, organizationId, personId);
}

/** Checklist pack person de una persona en la HAB del portal. */
export async function listMyContractorPersonDocuments(
  actor: PortalActor,
  personId: string,
) {
  const hab = await getMyContractorAccreditation(actor);
  return listAccreditationPersonDocuments(actor, hab.id, personId);
}

/** Upload doc pack person desde el portal. */
export async function createMyContractorPersonDocument(
  actor: PortalActor,
  personId: string,
  body: CreateContractorPortalDocumentBody,
): Promise<ContractorPersonDocumentResponse> {
  const hab = await getMyContractorAccreditation(actor);
  assertPortalMayUploadDocuments(hab);
  return createAccreditationPersonDocument(actor, hab.id, personId, body);
}

/** Resuelve archivo de doc persona para descarga portal. */
export async function resolveMyContractorPersonDocumentFile(
  actor: PortalActor,
  personId: string,
  documentId: string,
) {
  const hab = await getMyContractorAccreditation(actor);
  return resolveAccreditationPersonDocumentFile(
    actor,
    hab.id,
    personId,
    documentId,
  );
}

/** Portal E19: org del actor (antecedentes). */
export async function getMyContractorOrganization(
  actor: PortalActor,
): Promise<ContractorOrganizationResponse> {
  const organizationId = requirePortalOrgId(actor);
  return getContractorById(actor, organizationId);
}

/** Portal E19: actualiza antecedentes (sin RUT/rol/active). */
export async function updateMyContractorOrganization(
  actor: PortalActor,
  body: UpdateMyContractorOrganizationBody,
): Promise<ContractorOrganizationResponse> {
  const organizationId = requirePortalOrgId(actor);
  /** Null del portal limpia el campo; UpdateContractorBody tipa undefined. */
  const payload = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
    ...(body.contactName !== undefined
      ? { contactName: body.contactName }
      : {}),
    ...(body.contactEmail !== undefined
      ? { contactEmail: body.contactEmail }
      : {}),
    ...(body.contactPhone !== undefined
      ? { contactPhone: body.contactPhone }
      : {}),
    ...(body.legalRepresentative !== undefined
      ? { legalRepresentative: body.legalRepresentative }
      : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.mutual !== undefined ? { mutual: body.mutual } : {}),
    ...(body.supervisorName !== undefined
      ? { supervisorName: body.supervisorName }
      : {}),
    ...(body.supervisorEmail !== undefined
      ? { supervisorEmail: body.supervisorEmail }
      : {}),
    ...(body.prevencionistName !== undefined
      ? { prevencionistName: body.prevencionistName }
      : {}),
    ...(body.prevencionistEmail !== undefined
      ? { prevencionistEmail: body.prevencionistEmail }
      : {}),
    ...(body.subcontractors !== undefined
      ? { subcontractors: body.subcontractors }
      : {}),
    ...(body.workDescription !== undefined
      ? { workDescription: body.workDescription }
      : {}),
  } as UpdateContractorBody;
  return updateContractor(actor, organizationId, payload);
}
