import type { CrewMemberDocument, DocumentType } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { sniffCrewDocumentMime } from "../../lib/fileSniff.js";
import {
  ALLOWED_CREW_DOC_MIMES,
  MAX_CREW_DOC_BYTES,
  isCrewDocumentRelativePath,
  resolveUploadFullPath,
  writeCrewDocumentFile,
  unlinkCrewDocumentFile,
} from "../../lib/localUploads.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateCrewMemberDocumentBody,
  CrewMemberDocumentResponse,
} from "./crewMemberDocuments.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

/** Fila con tipo incluido. */
type DocWithType = CrewMemberDocument & { documentType: DocumentType };

/** Serializa fila → contrato (sin filePath). */
function toDocumentResponse(row: DocWithType): CrewMemberDocumentResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    crewMemberId: row.crewMemberId,
    documentTypeId: row.documentTypeId,
    documentType: {
      id: row.documentType.id,
      code: row.documentType.code,
      name: row.documentType.name,
      subtype: row.documentType.subtype,
    },
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    sourceModule: row.sourceModule,
    uploadedById: row.uploadedById,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 404 genérico si el actor no ve la empresa del tripulante. */
function assertCrewTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
}

/** Carga tripulante activo y valida tenant. */
async function loadCrewForActor(actor: Actor, crewMemberId: string) {
  const crew = await prisma.crewMember.findFirst({
    where: { id: crewMemberId, deletedAt: null },
  });
  if (!crew) {
    throw new AppError(
      404,
      "crew_member_not_found",
      "Tripulante no encontrado",
    );
  }
  assertCrewTenantAccess(actor, crew.businessId);
  return crew;
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

/** Lista documentos no borrados del tripulante. */
export async function listCrewMemberDocuments(
  actor: Actor,
  crewMemberId: string,
): Promise<{ items: CrewMemberDocumentResponse[]; total: number }> {
  await loadCrewForActor(actor, crewMemberId);

  const rows = await prisma.crewMemberDocument.findMany({
    where: { crewMemberId, deletedAt: null },
    include: { documentType: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    items: rows.map(toDocumentResponse),
    total: rows.length,
  };
}

/** Alta: valida tipo de la misma empresa, mime/tamaño, escribe disco. */
export async function createCrewMemberDocument(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberDocumentBody,
): Promise<CrewMemberDocumentResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);

  const docType = await prisma.documentType.findFirst({
    where: {
      id: body.documentTypeId,
      businessId: crew.businessId,
      deletedAt: null,
      state: true,
    },
  });
  if (!docType) {
    throw new AppError(
      400,
      "document_type_not_found",
      "Tipo de documento no válido para esta empresa",
    );
  }

  if (!ALLOWED_CREW_DOC_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (PDF, Word, JPEG, PNG o WebP)",
    );
  }

  const buffer = decodeBase64Content(body.contentBase64);
  if (!buffer.length) {
    throw new AppError(400, "validation_error", "Archivo vacío o base64 inválido");
  }
  if (buffer.length > MAX_CREW_DOC_BYTES) {
    throw new AppError(
      400,
      "validation_error",
      "El archivo supera el máximo de 10 MB",
    );
  }

  // Magic bytes: el contenido real manda sobre el mimeType del cliente.
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

  const written = await writeCrewDocumentFile({
    businessId: crew.businessId,
    crewMemberId: crew.id,
    type: docType.code.toLowerCase(),
    mimeType: sniffed,
    buffer,
  });

  const row = await prisma.crewMemberDocument.create({
    data: {
      crewMemberId: crew.id,
      documentTypeId: docType.id,
      originalName: body.fileName.trim(),
      mimeType: sniffed,
      size: written.size,
      filePath: written.relativePath,
      sourceModule: body.sourceModule ?? "crew",
      uploadedById: actor.id,
    },
    include: { documentType: true },
  });

  return toDocumentResponse(row);
}

/**
 * Resuelve archivo en disco para descarga.
 * No expone filePath al cliente.
 */
export async function resolveCrewMemberDocumentFile(
  actor: Actor,
  crewMemberId: string,
  documentId: string,
): Promise<{
  fullPath: string;
  originalName: string;
  mimeType: string;
}> {
  await loadCrewForActor(actor, crewMemberId);

  const doc = await prisma.crewMemberDocument.findFirst({
    where: {
      id: documentId,
      crewMemberId,
      deletedAt: null,
    },
  });
  if (!doc) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }
  if (!isCrewDocumentRelativePath(doc.filePath)) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }
  const fullPath = resolveUploadFullPath(doc.filePath);
  if (!fullPath) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }

  return {
    fullPath,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
  };
}

/** Soft delete + intenta borrar archivo. */
export async function deleteCrewMemberDocument(
  actor: Actor,
  crewMemberId: string,
  documentId: string,
): Promise<CrewMemberDocumentResponse> {
  await loadCrewForActor(actor, crewMemberId);

  const existing = await prisma.crewMemberDocument.findFirst({
    where: { id: documentId, crewMemberId, deletedAt: null },
    include: { documentType: true },
  });
  if (!existing) {
    throw new AppError(404, "document_not_found", "Documento no encontrado");
  }

  const updated = await prisma.crewMemberDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
    include: { documentType: true },
  });

  await unlinkCrewDocumentFile(existing.filePath);
  return toDocumentResponse(updated);
}
