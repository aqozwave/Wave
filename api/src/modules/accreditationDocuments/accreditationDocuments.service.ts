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
    where: { id: accreditationId, deletedAt: null },
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
 * Tipos empresa cargables en la HAB: pack company +
 * exigencias document/company de tipos de permiso + pedidos adicionales.
 */
async function resolveCompanyUploadableDocTypes(
  businessId: string,
  opts?: { additionalTypeIds?: string[] },
): Promise<
  Array<{
    type: DocumentType;
    source: "pack" | "permit_requirement" | "both" | "additional";
  }>
> {
  const additionalTypeIds = opts?.additionalTypeIds?.filter(Boolean) ?? [];
  const [packTypes, reqRows, additionalTypes] = await Promise.all([
    prisma.documentType.findMany({
      where: {
        businessId,
        deletedAt: null,
        state: true,
        accreditationPack: "company",
      },
      orderBy: [{ code: "asc" }],
    }),
    prisma.permitTypeRequirement.findMany({
      where: {
        active: true,
        kind: "document",
        scope: "company",
        documentTypeId: { not: null },
        permitType: { businessId, deletedAt: null, active: true },
        documentType: { deletedAt: null, state: true },
      },
      select: { documentType: true },
    }),
    additionalTypeIds.length === 0
      ? Promise.resolve([] as DocumentType[])
      : prisma.documentType.findMany({
          where: {
            businessId,
            id: { in: additionalTypeIds },
            deletedAt: null,
            state: true,
          },
        }),
  ]);

  const byId = new Map<
    string,
    {
      type: DocumentType;
      pack: boolean;
      requirement: boolean;
      additional: boolean;
    }
  >();
  for (const t of packTypes) {
    byId.set(t.id, {
      type: t,
      pack: true,
      requirement: false,
      additional: false,
    });
  }
  for (const row of reqRows) {
    if (!row.documentType) continue;
    const existing = byId.get(row.documentType.id);
    if (existing) {
      existing.requirement = true;
    } else {
      byId.set(row.documentType.id, {
        type: row.documentType,
        pack: false,
        requirement: true,
        additional: false,
      });
    }
  }
  for (const t of additionalTypes) {
    const existing = byId.get(t.id);
    if (existing) {
      existing.additional = true;
    } else {
      byId.set(t.id, {
        type: t,
        pack: false,
        requirement: false,
        additional: true,
      });
    }
  }

  return [...byId.values()]
    .map((row) => {
      let source: "pack" | "permit_requirement" | "both" | "additional";
      if (row.pack && row.requirement) source = "both";
      else if (row.pack) source = "pack";
      else if (row.requirement) source = "permit_requirement";
      else source = "additional";
      return { type: row.type, source };
    })
    .sort((a, b) => a.type.code.localeCompare(b.type.code));
}

/**
 * Checklist P5: pack company + exigencias document/company de tipos de permiso.
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
    source: "pack" | "permit_requirement" | "both" | "additional";
    packRequired: boolean;
    requestedAdditional: boolean;
    document: ContractorOrgDocumentResponse | null;
  }>;
  total: number;
}> {
  const hab = await loadAccreditationForActor(actor, accreditationId);

  const additionalTypeIds =
    hab.awaitingAdditionalDocs && hab.additionalDocsTypeIds.length > 0
      ? hab.additionalDocsTypeIds
      : [];
  const uploadable = await resolveCompanyUploadableDocTypes(
    hab.organization.businessId,
    { additionalTypeIds },
  );
  const requestedSet = new Set(additionalTypeIds);

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

  const items = uploadable.map((slot) => {
    const t = slot.type;
    const doc = latestByType.get(t.id) ?? null;
    /** Exigencia / pedido adicional: obligatorio; pack respeta el flag. */
    const packRequired =
      slot.source === "permit_requirement" || slot.source === "additional"
        ? true
        : t.accreditationPackRequired;
    return {
      documentType: {
        id: t.id,
        code: t.code,
        name: t.name,
        requiresExpiry: t.requiresExpiry,
      },
      source: slot.source,
      packRequired,
      requestedAdditional: requestedSet.has(t.id),
      document: doc ? toDocResponse(doc) : null,
    };
  });

  return { items, total: items.length };
}

/**
 * HAB rejected = cerrada.
 * Approved + pedido adicional: solo tipos en additionalDocsTypeIds y sin archivo.
 * Sigue approved para no perder la habilitación.
 */
async function assertHabAllowsCompanyUpload(
  hab: {
    id: string;
    status: string;
    awaitingAdditionalDocs: boolean;
    additionalDocsTypeIds: string[];
  },
  documentTypeId: string,
): Promise<{ reopenForReview: boolean }> {
  if (hab.status === "rejected") {
    throw new AppError(
      400,
      "accreditation_closed",
      "No se pueden cargar documentos en una HAB cerrada",
    );
  }
  if (hab.status !== "approved") {
    return { reopenForReview: false };
  }
  if (
    !hab.awaitingAdditionalDocs ||
    !hab.additionalDocsTypeIds.includes(documentTypeId)
  ) {
    throw new AppError(
      400,
      "accreditation_closed",
      "La HAB está aprobada; solo se pueden subir los tipos que Prevención pidió como adicionales",
    );
  }
  const existing = await prisma.contractorOrgDocument.findFirst({
    where: {
      accreditationId: hab.id,
      documentTypeId,
      deletedAt: null,
      status: { not: "replaced" },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      400,
      "accreditation_closed",
      "La HAB está aprobada; no se puede reemplazar un documento ya cargado. Pedile a Prevención que la observe.",
    );
  }
  /** Hueco adicional: no reabrir a in_review (sigue habilitada). */
  return { reopenForReview: false };
}

/**
 * Sube un doc company a la HAB (pack o exigencia de tipo de permiso).
 * Reemplaza el anterior del mismo tipo.
 */
export async function createAccreditationDocument(
  actor: Actor,
  accreditationId: string,
  body: CreateAccreditationDocumentBody,
): Promise<ContractorOrgDocumentResponse> {
  const hab = await loadAccreditationForActor(actor, accreditationId);

  const additionalTypeIds =
    hab.awaitingAdditionalDocs && hab.additionalDocsTypeIds.length > 0
      ? hab.additionalDocsTypeIds
      : [];
  const uploadable = await resolveCompanyUploadableDocTypes(
    hab.organization.businessId,
    { additionalTypeIds },
  );
  const allowed = uploadable.find((s) => s.type.id === body.documentTypeId);
  const docType = allowed?.type ?? null;
  if (!docType) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo no válido: no está en el pack empresa, exigencias ni pedido adicional",
    );
  }

  const { reopenForReview } = await assertHabAllowsCompanyUpload(
    hab,
    docType.id,
  );

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

    const row = await tx.contractorOrgDocument.create({
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

    // Completar huecos tras un approve incompleto → vuelve a revisión.
    if (reopenForReview) {
      await tx.contractorAccreditation.update({
        where: { id: hab.id },
        data: {
          status: "in_review",
          reviewedAt: null,
          reviewedById: null,
          reviewNote: null,
        },
      });
    }

    return row;
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

  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.contractorOrgDocument.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        observation,
        validatedById: actor.id,
        validatedAt: new Date(),
      },
      include: { documentType: true },
    });

    /**
     * Observar un doc en revisión = devolver la HAB al contratista.
     * Si no, el portal sigue en in_review y no puede reemplazar.
     */
    if (body.status === "observed") {
      const hab = await tx.contractorAccreditation.findFirst({
        where: { id: accreditationId },
        select: { status: true },
      });
      if (hab?.status === "in_review") {
        await tx.contractorAccreditation.update({
          where: { id: accreditationId },
          data: {
            status: "observed",
            reviewNote: observation,
            reviewedAt: new Date(),
            reviewedById: actor.id,
          },
        });
      }
    }

    return doc;
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

/**
 * Tipos que una persona puede subir en la HAB.
 * - Pack person: siempre (habilitación).
 * - Exigencias document/person (faena): solo si esa persona ya está asignada
 *   a un PT abierto de la org cuyo tipo las pide. No se cargan a todo el personal.
 */
async function resolvePersonUploadableDocTypes(
  businessId: string,
  opts: { organizationId: string; personId: string },
): Promise<
  Array<{
    type: DocumentType;
    source: "pack" | "permit_requirement" | "both";
  }>
> {
  const packTypes = await prisma.documentType.findMany({
    where: {
      businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "person",
    },
    orderBy: [{ code: "asc" }],
  });

  /** PT abiertos de la org donde esta persona está asignada. */
  const openStatuses = [
    "to_complete",
    "to_approve",
    "to_receive",
    "active",
    "to_verify",
    "no_closure",
  ] as const;

  /** Docs de faena + evidencia de capacitaciones del tipo (si la persona está en el PT). */
  const reqRows = await prisma.permitTypeRequirement.findMany({
    where: {
      active: true,
      scope: "person",
      OR: [
        {
          kind: "document",
          documentTypeId: { not: null },
          documentType: { deletedAt: null, state: true },
        },
        {
          kind: "training",
          OR: [
            { training: { documentTypeId: { not: null } } },
            { trainingCode: { not: null } },
          ],
        },
      ],
      permitType: {
        businessId,
        deletedAt: null,
        active: true,
        workPermits: {
          some: {
            deletedAt: null,
            organizationId: opts.organizationId,
            status: { in: [...openStatuses] },
            people: { some: { personId: opts.personId } },
          },
        },
      },
    },
    select: {
      documentType: true,
      trainingCode: true,
      training: {
        select: {
          code: true,
          documentType: true,
        },
      },
    },
  });

  const byId = new Map<
    string,
    { type: DocumentType; pack: boolean; requirement: boolean }
  >();
  for (const t of packTypes) {
    byId.set(t.id, { type: t, pack: true, requirement: false });
  }

  /** Códigos de capacitación sin Training.documentTypeId enlazado. */
  const fallbackCodes = new Set<string>();
  for (const row of reqRows) {
    const linked =
      row.documentType ?? row.training?.documentType ?? null;
    if (linked && !linked.deletedAt && linked.state) {
      const existing = byId.get(linked.id);
      if (existing) {
        existing.requirement = true;
      } else {
        byId.set(linked.id, {
          type: linked,
          pack: false,
          requirement: true,
        });
      }
      continue;
    }
    const code = (row.trainingCode ?? row.training?.code ?? "").trim();
    if (code) fallbackCodes.add(code);
  }
  if (fallbackCodes.size > 0) {
    const fallbackDocs = await prisma.documentType.findMany({
      where: {
        businessId,
        deletedAt: null,
        state: true,
        code: { in: [...fallbackCodes] },
      },
    });
    for (const linked of fallbackDocs) {
      const existing = byId.get(linked.id);
      if (existing) {
        existing.requirement = true;
      } else {
        byId.set(linked.id, {
          type: linked,
          pack: false,
          requirement: true,
        });
      }
    }
  }

  return [...byId.values()]
    .map((row) => ({
      type: row.type,
      source:
        row.pack && row.requirement
          ? ("both" as const)
          : row.pack
            ? ("pack" as const)
            : ("permit_requirement" as const),
    }))
    .sort((a, b) => a.type.code.localeCompare(b.type.code));
}

/**
 * Checklist pack person (+ exigencias de faena solo si la persona está
 * asignada a un PT abierto que las pide).
 */
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
    /** pack = habilitación; permit_requirement = exigencia de tipo (BUC…); both = ambos. */
    source: "pack" | "permit_requirement" | "both";
    packRequired: boolean;
    document: ContractorPersonDocumentResponse | null;
  }>;
  total: number;
}> {
  const { hab, person } = await loadPersonInHab(
    actor,
    accreditationId,
    personId,
  );

  const uploadable = await resolvePersonUploadableDocTypes(
    hab.organization.businessId,
    { organizationId: hab.organizationId, personId: person.id },
  );

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

  const items = uploadable.map(({ type: t, source }) => {
    const doc = latestByType.get(t.id) ?? null;
    const packRequired =
      source === "permit_requirement" ? true : t.accreditationPackRequired;
    return {
      documentType: {
        id: t.id,
        code: t.code,
        name: t.name,
        requiresExpiry: t.requiresExpiry,
      },
      source,
      packRequired,
      document: doc ? toPersonDocResponse(doc) : null,
    };
  });

  return { items, total: items.length };
}

/**
 * Misma regla que empresa: approved solo completar tipo vacío;
 * sigue approved (Prevención valida el archivo nuevo).
 */
async function assertHabAllowsPersonUpload(
  hab: { id: string; status: string },
  personId: string,
  documentTypeId: string,
): Promise<{ reopenForReview: boolean }> {
  if (hab.status === "rejected") {
    throw new AppError(
      400,
      "accreditation_closed",
      "No se pueden cargar documentos en una HAB cerrada",
    );
  }
  if (hab.status !== "approved") {
    return { reopenForReview: false };
  }
  const existing = await prisma.contractorPersonDocument.findFirst({
    where: {
      accreditationId: hab.id,
      personId,
      documentTypeId,
      deletedAt: null,
      status: { not: "replaced" },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      400,
      "accreditation_closed",
      "La HAB está aprobada; no se puede reemplazar un documento ya cargado. Pedile a Prevención que la observe.",
    );
  }
  return { reopenForReview: false };
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

  /** Pack person, o exigencia de faena si ya está asignada a un PT que la pide. */
  const uploadable = await resolvePersonUploadableDocTypes(
    hab.organization.businessId,
    { organizationId: hab.organizationId, personId: person.id },
  );
  const allowed = uploadable.find((row) => row.type.id === body.documentTypeId);
  const docType = allowed?.type ?? null;
  if (!docType) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo no válido: pack persona, o exigencia de faena de un permiso al que esta persona está asignada",
    );
  }

  const { reopenForReview } = await assertHabAllowsPersonUpload(
    hab,
    person.id,
    docType.id,
  );

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

    const row = await tx.contractorPersonDocument.create({
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

    if (reopenForReview) {
      await tx.contractorAccreditation.update({
        where: { id: hab.id },
        data: {
          status: "in_review",
          reviewedAt: null,
          reviewedById: null,
          reviewNote: null,
        },
      });
    }

    return row;
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

  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.contractorPersonDocument.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        observation,
        validatedById: actor.id,
        validatedAt: new Date(),
      },
      include: { documentType: true },
    });

    // Misma regla que docs de empresa: observar → HAB observed.
    if (body.status === "observed") {
      const hab = await tx.contractorAccreditation.findFirst({
        where: { id: accreditationId },
        select: { status: true },
      });
      if (hab?.status === "in_review") {
        await tx.contractorAccreditation.update({
          where: { id: accreditationId },
          data: {
            status: "observed",
            reviewNote: observation,
            reviewedAt: new Date(),
            reviewedById: actor.id,
          },
        });
      }
    }

    return doc;
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
