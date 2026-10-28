import type { CrewMemberDocument } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import {
  ALLOWED_CREW_DOC_MIMES,
  MAX_CREW_DOC_BYTES,
  isCrewDocumentRelativePath,
  resolveUploadFullPath,
  writeCrewDocumentFile,
} from "../../lib/localUploads.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateCrewMemberDocumentBody,
  CrewMemberDocumentResponse,
} from "./crewMemberDocuments.schemas.js";

/** Actor mínimo tenant. */
type Actor = Pick<AuthUser, "id" | "internalRol" | "businessId">;

/** Serializa fila → contrato (sin filePath). */
function toDocumentResponse(row: CrewMemberDocument): CrewMemberDocumentResponse {
  return {
    id: row.id,
    legacyMongoId: row.legacyMongoId,
    crewMemberId: row.crewMemberId,
    type: row.type,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    uploadedById: row.uploadedById,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 404 genérico si el actor no ve la empresa del tripulante. */
function assertCrewTenantAccess(
  actor: Actor,
  businessId: string,
): void {
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
    orderBy: { createdAt: "desc" },
  });

  return {
    items: rows.map(toDocumentResponse),
    total: rows.length,
  };
}

/** Alta: valida mime/tamaño, escribe disco, guarda metadatos. */
export async function createCrewMemberDocument(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberDocumentBody,
): Promise<CrewMemberDocumentResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);

  if (!ALLOWED_CREW_DOC_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (PDF, JPEG, PNG o WebP)",
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

  const written = await writeCrewDocumentFile({
    businessId: crew.businessId,
    crewMemberId: crew.id,
    type: body.type,
    mimeType: body.mimeType,
    buffer,
  });

  const row = await prisma.crewMemberDocument.create({
    data: {
      crewMemberId: crew.id,
      type: body.type,
      originalName: body.fileName.trim(),
      mimeType: body.mimeType,
      size: written.size,
      filePath: written.relativePath,
      uploadedById: actor.id,
    },
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

/** Soft delete: marca deletedAt y conserva el archivo en disco (recuperable). */
export async function deleteCrewMemberDocument(
  actor: Actor,
  crewMemberId: string,
  documentId: string,
): Promise<CrewMemberDocumentResponse> {
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

  const updated = await prisma.crewMemberDocument.update({
    where: { id: doc.id },
    data: { deletedAt: new Date() },
  });

  return toDocumentResponse(updated);
}
