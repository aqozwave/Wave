import type {
  ContractorOrgDocument,
  ContractorPersonDocument,
  DocumentType,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { sniffCrewDocumentMime } from "../../lib/fileSniff.js";
import {
  ALLOWED_CONTRACTOR_ORG_DOC_MIMES,
  MAX_CONTRACTOR_ORG_DOC_BYTES,
  isContractorOrgDocumentRelativePath,
  isContractorPersonDocumentRelativePath,
  resolveUploadFullPath,
  unlinkContractorOrgDocumentFile,
  unlinkContractorPersonDocumentFile,
  writeContractorOrgDocumentFile,
  writeContractorPersonDocumentFile,
} from "../../lib/localUploads.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  ContractorOrgDocumentResponse,
  ContractorPersonDocumentResponse,
  CreateAccreditationDocumentBody,
  ValidateAccreditationDocumentBody,
} from "./accreditationDocuments.schemas.js";

/** Actor mínimo para tenant + auditoría. */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

/** Fila con tipo incluido. */
type DocWithType = ContractorOrgDocument & {
  documentType: DocumentType;
};

/** Serializa documento sin filePath. */
function toDocResponse(row: DocWithType): ContractorOrgDocumentResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    accreditationId: row.accreditationId,
    documentTypeId: row.documentTypeId,
    documentType: {
      id: row.documentType.id,
      code: row.documentType.code,
      name: row.documentType.name,
      requiresExpiry: row.documentType.requiresExpiry,
    },
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    observation: row.observation,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    uploadedById: row.uploadedById,
    validatedById: row.validatedById,
    validatedAt: row.validatedAt ? row.validatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 404 genérico si el actor no ve la empresa. */
function assertTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
}

/** Carga HAB + org; valida tenant. */
async function loadAccreditationForActor(actor: Actor, accreditationId: string) {
  const row = await prisma.contractorAccreditation.findFirst({
    where: { id: accreditationId },
    include: {
      organization: {
        select: {
          id: true,
          businessId: true,
          deletedAt: true,
          active: true,
        },
      },
    },
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(
      404,
      "accreditation_not_found",
      "Habilitación no encontrada",
    );
  }
  assertTenantAccess(actor, row.organization.businessId);
  return row;
}

/** Decodifica base64 (raw o data-URL). */
function decodeBase64Content(contentBase64: string): Buffer {
  const trimmed = contentBase64.trim();
  const comma = trimmed.indexOf(",");
  const payload =
    trimmed.startsWith("data:") && comma >= 0
      ? trimmed.slice(comma + 1)
      : trimmed;
  return Buffer.from(payload, "base64");
}

/**
 * Checklist P5: tipos del pack `company` de la empresa + doc vigente.
 * Doc vigente = último no deleted/replaced para ese tipo en esta HAB.
 */
export async function listAccreditationDocuments(
  actor: Actor,
  accreditationId: string,
): Promise<{
  items: Array<{
    documentType: {
      id: string;
      code: string;
      name: string;
      requiresExpiry: boolean;
    };
    document: ContractorOrgDocumentResponse | null;
  }>;
  total: number;
}> {
  const hab = await loadAccreditationForActor(actor, accreditationId);

  const types = await prisma.documentType.findMany({
    where: {
      businessId: hab.organization.businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "company",
    },
    orderBy: [{ code: "asc" }],
  });

  const docs = await prisma.contractorOrgDocument.findMany({
    where: {
      accreditationId: hab.id,
      deletedAt: null,
      status: { not: "replaced" },
    },
    include: { documentType: true },
    orderBy: { createdAt: "desc" },
  });

  /** Último doc por tipo. */
  const latestByType = new Map<string, DocWithType>();
  for (const doc of docs) {
    if (!latestByType.has(doc.documentTypeId)) {
      latestByType.set(doc.documentTypeId, doc);
    }
  }

  const items = types.map((t) => {
    const doc = latestByType.get(t.id) ?? null;
    return {
      documentType: {
        id: t.id,
        code: t.code,
        name: t.name,
        requiresExpiry: t.requiresExpiry,
      },
      document: doc ? toDocResponse(doc) : null,
    };
  });

  return { items, total: items.length };
}

/** Sube un doc del pack company a la HAB (reemplaza el anterior del mismo tipo). */
export async function createAccreditationDocument(
  actor: Actor,
  accreditationId: string,
  body: CreateAccreditationDocumentBody,
): Promise<ContractorOrgDocumentResponse> {
  const hab = await loadAccreditationForActor(actor, accreditationId);

  if (
    hab.status === "approved" ||
    hab.status === "rejected"
  ) {
    throw new AppError(
      400,
      "accreditation_closed",
      "No se pueden cargar documentos en una HAB cerrada",
    );
  }

  const docType = await prisma.documentType.findFirst({
    where: {
      id: body.documentTypeId,
      businessId: hab.organization.businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "company",
    },
  });
  if (!docType) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo no válido o fuera del pack de empresa",
    );
  }

  if (docType.requiresExpiry && !body.expiresAt) {
    throw new AppError(
      400,
      "validation_error",
      "Este tipo exige fecha de vencimiento",
    );
  }

  if (!ALLOWED_CONTRACTOR_ORG_DOC_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (PDF, Word, JPEG, PNG o WebP)",
    );
  }

  const buffer = decodeBase64Content(body.contentBase64);
  if (!buffer.length) {
    throw new AppError(
      400,
      "validation_error",
      "Archivo vacío o base64 inválido",
    );
  }
  if (buffer.length > MAX_CONTRACTOR_ORG_DOC_BYTES) {
    throw new AppError(
      400,
      "validation_error",
      "El archivo supera el máximo de 10 MB",
    );
  }

  const sniffed = sniffCrewDocumentMime(buffer);
  if (!sniffed) {
    throw new AppError(
      400,
      "validation_error",
      "El contenido del archivo no es un PDF, Word, JPEG, PNG o WebP válido",
    );
  }
  if (sniffed !== body.mimeType) {
    throw new AppError(
      400,
      "validation_error",
      "El tipo declarado no coincide con el contenido del archivo",
    );
  }

  const expiresAt =
    body.expiresAt === undefined || body.expiresAt === null
      ? null
      : new Date(body.expiresAt);

  const written = await writeContractorOrgDocumentFile({
    businessId: hab.organization.businessId,
    organizationId: hab.organizationId,
    accreditationId: hab.id,
    type: docType.code.toLowerCase(),
    mimeType: sniffed,
    buffer,
  });

  const created = await prisma.$transaction(async (tx) => {
    // Marca el vigente anterior como replaced (mismo tipo en esta HAB).
    await tx.contractorOrgDocument.updateMany({
      where: {
        accreditationId: hab.id,
        documentTypeId: docType.id,
        deletedAt: null,
        status: { not: "replaced" },
      },
      data: { status: "replaced" },
    });

    return tx.contractorOrgDocument.create({
      data: {
        organizationId: hab.organizationId,
        accreditationId: hab.id,
        documentTypeId: docType.id,
        originalName: body.fileName.trim(),
        mimeType: sniffed,
        size: written.size,
        filePath: written.relativePath,
        status: "pending_validation",
        expiresAt,
        uploadedById: actor.id,
      },
      include: { documentType: true },
    });
  });

  return toDocResponse(created);
}

/** Resuelve archivo en disco para descarga autenticada. */
export async function resolveAccreditationDocumentFile(
  actor: Actor,
  accreditationId: string,
  documentId: string,
): Promise<{ fullPath: string; mimeType: string; originalName: string }> {
  await loadAccreditationForActor(actor, accreditationId);
  const doc = await prisma.contractorOrgDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      deletedAt: null,
    },
  });
  if (!doc) {
    throw new AppError(
      404,
      "document_not_found",
      "Documento no encontrado",
    );
  }
  if (!isContractorOrgDocumentRelativePath(doc.filePath)) {
    throw new AppError(500, "invalid_file_path", "Ruta de archivo inválida");
  }
  const fullPath = resolveUploadFullPath(doc.filePath);
  if (!fullPath) {
    throw new AppError(500, "invalid_file_path", "Ruta de archivo inválida");
  }
  return {
    fullPath,
    mimeType: doc.mimeType,
    originalName: doc.originalName,
  };
}

/** Valida u observa un documento pendiente. */
export async function validateAccreditationDocument(
  actor: Actor,
  accreditationId: string,
  documentId: string,
  body: ValidateAccreditationDocumentBody,
): Promise<ContractorOrgDocumentResponse> {
  await loadAccreditationForActor(actor, accreditationId);
  const existing = await prisma.contractorOrgDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      deletedAt: null,
      status: { not: "replaced" },
    },
    include: { documentType: true },
  });
  if (!existing) {
    throw new AppError(
      404,
      "document_not_found",
      "Documento no encontrado",
    );
  }
  if (
    existing.status !== "pending_validation" &&
    existing.status !== "observed"
  ) {
    throw new AppError(
      400,
      "invalid_document_status",
      "Solo se pueden revisar documentos pendientes u observados",
    );
  }

  const observation =
    body.observation === undefined || body.observation === null
      ? null
      : body.observation.trim() || null;

  if (body.status === "observed" && !observation) {
    throw new AppError(
      400,
      "validation_error",
      "La observación es requerida al observar",
    );
  }

  const updated = await prisma.contractorOrgDocument.update({
    where: { id: existing.id },
    data: {
      status: body.status,
      observation,
      validatedById: actor.id,
      validatedAt: new Date(),
    },
    include: { documentType: true },
  });
  return toDocResponse(updated);
}

/** Soft delete + borra archivo. */
export async function deleteAccreditationDocument(
  actor: Actor,
  accreditationId: string,
  documentId: string,
): Promise<ContractorOrgDocumentResponse> {
  await loadAccreditationForActor(actor, accreditationId);
  const existing = await prisma.contractorOrgDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      deletedAt: null,
    },
    include: { documentType: true },
  });
  if (!existing) {
    throw new AppError(
      404,
      "document_not_found",
      "Documento no encontrado",
    );
  }

  const updated = await prisma.contractorOrgDocument.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: "replaced" },
    include: { documentType: true },
  });
  await unlinkContractorOrgDocumentFile(existing.filePath);
  return toDocResponse(updated);
}

/** Fila persona+tipo. */
type PersonDocWithType = ContractorPersonDocument & {
  documentType: DocumentType;
};

/** Serializa doc de persona. */
function toPersonDocResponse(
  row: PersonDocWithType,
): ContractorPersonDocumentResponse {
  return {
    id: row.id,
    personId: row.personId,
    accreditationId: row.accreditationId,
    documentTypeId: row.documentTypeId,
    documentType: {
      id: row.documentType.id,
      code: row.documentType.code,
      name: row.documentType.name,
      requiresExpiry: row.documentType.requiresExpiry,
    },
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    observation: row.observation,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    uploadedById: row.uploadedById,
    validatedById: row.validatedById,
    validatedAt: row.validatedAt ? row.validatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Carga persona de la org de la HAB. */
async function loadPersonInHab(
  actor: Actor,
  accreditationId: string,
  personId: string,
) {
  const hab = await loadAccreditationForActor(actor, accreditationId);
  const person = await prisma.contractorPerson.findFirst({
    where: {
      id: personId,
      organizationId: hab.organizationId,
      deletedAt: null,
    },
  });
  if (!person) {
    throw new AppError(
      404,
      "contractor_person_not_found",
      "Persona no encontrada en esta organización",
    );
  }
  return { hab, person };
}

/** Checklist pack person para una persona en la HAB. */
export async function listAccreditationPersonDocuments(
  actor: Actor,
  accreditationId: string,
  personId: string,
): Promise<{
  items: Array<{
    documentType: {
      id: string;
      code: string;
      name: string;
      requiresExpiry: boolean;
    };
    document: ContractorPersonDocumentResponse | null;
  }>;
  total: number;
}> {
  const { hab, person } = await loadPersonInHab(
    actor,
    accreditationId,
    personId,
  );

  const types = await prisma.documentType.findMany({
    where: {
      businessId: hab.organization.businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "person",
    },
    orderBy: [{ code: "asc" }],
  });

  const docs = await prisma.contractorPersonDocument.findMany({
    where: {
      accreditationId: hab.id,
      personId: person.id,
      deletedAt: null,
      status: { not: "replaced" },
    },
    include: { documentType: true },
    orderBy: { createdAt: "desc" },
  });

  const latestByType = new Map<string, PersonDocWithType>();
  for (const doc of docs) {
    if (!latestByType.has(doc.documentTypeId)) {
      latestByType.set(doc.documentTypeId, doc);
    }
  }

  const items = types.map((t) => {
    const doc = latestByType.get(t.id) ?? null;
    return {
      documentType: {
        id: t.id,
        code: t.code,
        name: t.name,
        requiresExpiry: t.requiresExpiry,
      },
      document: doc ? toPersonDocResponse(doc) : null,
    };
  });

  return { items, total: items.length };
}

/** Sube doc pack person (reemplaza vigente del mismo tipo). */
export async function createAccreditationPersonDocument(
  actor: Actor,
  accreditationId: string,
  personId: string,
  body: CreateAccreditationDocumentBody,
): Promise<ContractorPersonDocumentResponse> {
  const { hab, person } = await loadPersonInHab(
    actor,
    accreditationId,
    personId,
  );

  if (hab.status === "approved" || hab.status === "rejected") {
    throw new AppError(
      400,
      "accreditation_closed",
      "No se pueden cargar documentos en una HAB cerrada",
    );
  }

  const docType = await prisma.documentType.findFirst({
    where: {
      id: body.documentTypeId,
      businessId: hab.organization.businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "person",
    },
  });
  if (!docType) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo no válido o fuera del pack de persona",
    );
  }

  if (docType.requiresExpiry && !body.expiresAt) {
    throw new AppError(
      400,
      "validation_error",
      "Este tipo exige fecha de vencimiento",
    );
  }

  if (!ALLOWED_CONTRACTOR_ORG_DOC_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (PDF, Word, JPEG, PNG o WebP)",
    );
  }

  const buffer = decodeBase64Content(body.contentBase64);
  if (!buffer.length) {
    throw new AppError(
      400,
      "validation_error",
      "Archivo vacío o base64 inválido",
    );
  }
  if (buffer.length > MAX_CONTRACTOR_ORG_DOC_BYTES) {
    throw new AppError(
      400,
      "validation_error",
      "El archivo supera el máximo de 10 MB",
    );
  }

  const sniffed = sniffCrewDocumentMime(buffer);
  if (!sniffed) {
    throw new AppError(
      400,
      "validation_error",
      "El contenido del archivo no es un PDF, Word, JPEG, PNG o WebP válido",
    );
  }
  if (sniffed !== body.mimeType) {
    throw new AppError(
      400,
      "validation_error",
      "El tipo declarado no coincide con el contenido del archivo",
    );
  }

  const expiresAt =
    body.expiresAt === undefined || body.expiresAt === null
      ? null
      : new Date(body.expiresAt);

  const written = await writeContractorPersonDocumentFile({
    businessId: hab.organization.businessId,
    organizationId: hab.organizationId,
    personId: person.id,
    accreditationId: hab.id,
    type: docType.code.toLowerCase(),
    mimeType: sniffed,
    buffer,
  });

  const created = await prisma.$transaction(async (tx) => {
    await tx.contractorPersonDocument.updateMany({
      where: {
        accreditationId: hab.id,
        personId: person.id,
        documentTypeId: docType.id,
        deletedAt: null,
        status: { not: "replaced" },
      },
      data: { status: "replaced" },
    });

    return tx.contractorPersonDocument.create({
      data: {
        personId: person.id,
        accreditationId: hab.id,
        documentTypeId: docType.id,
        originalName: body.fileName.trim(),
        mimeType: sniffed,
        size: written.size,
        filePath: written.relativePath,
        status: "pending_validation",
        expiresAt,
        uploadedById: actor.id,
      },
      include: { documentType: true },
    });
  });

  return toPersonDocResponse(created);
}

/** Descarga autenticada de doc de persona. */
export async function resolveAccreditationPersonDocumentFile(
  actor: Actor,
  accreditationId: string,
  personId: string,
  documentId: string,
): Promise<{ fullPath: string; mimeType: string; originalName: string }> {
  await loadPersonInHab(actor, accreditationId, personId);
  const doc = await prisma.contractorPersonDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      personId,
      deletedAt: null,
    },
  });
  if (!doc) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }
  if (!isContractorPersonDocumentRelativePath(doc.filePath)) {
    throw new AppError(500, "invalid_file_path", "Ruta de archivo inválida");
  }
  const fullPath = resolveUploadFullPath(doc.filePath);
  if (!fullPath) {
    throw new AppError(500, "invalid_file_path", "Ruta de archivo inválida");
  }
  return {
    fullPath,
    mimeType: doc.mimeType,
    originalName: doc.originalName,
  };
}

/** Valida u observa doc de persona. */
export async function validateAccreditationPersonDocument(
  actor: Actor,
  accreditationId: string,
  personId: string,
  documentId: string,
  body: ValidateAccreditationDocumentBody,
): Promise<ContractorPersonDocumentResponse> {
  await loadPersonInHab(actor, accreditationId, personId);
  const existing = await prisma.contractorPersonDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      personId,
      deletedAt: null,
      status: { not: "replaced" },
    },
    include: { documentType: true },
  });
  if (!existing) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }
  if (
    existing.status !== "pending_validation" &&
    existing.status !== "observed"
  ) {
    throw new AppError(
      400,
      "invalid_document_status",
      "Solo se pueden revisar documentos pendientes u observados",
    );
  }

  const observation =
    body.observation === undefined || body.observation === null
      ? null
      : body.observation.trim() || null;

  if (body.status === "observed" && !observation) {
    throw new AppError(
      400,
      "validation_error",
      "La observación es requerida al observar",
    );
  }

  const updated = await prisma.contractorPersonDocument.update({
    where: { id: existing.id },
    data: {
      status: body.status,
      observation,
      validatedById: actor.id,
      validatedAt: new Date(),
    },
    include: { documentType: true },
  });
  return toPersonDocResponse(updated);
}

/** Soft delete doc de persona. */
export async function deleteAccreditationPersonDocument(
  actor: Actor,
  accreditationId: string,
  personId: string,
  documentId: string,
): Promise<ContractorPersonDocumentResponse> {
  await loadPersonInHab(actor, accreditationId, personId);
  const existing = await prisma.contractorPersonDocument.findFirst({
    where: {
      id: documentId,
      accreditationId,
      personId,
      deletedAt: null,
    },
    include: { documentType: true },
  });
  if (!existing) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }

  const updated = await prisma.contractorPersonDocument.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: "replaced" },
    include: { documentType: true },
  });
  await unlinkContractorPersonDocumentFile(existing.filePath);
  return toPersonDocResponse(updated);
}
