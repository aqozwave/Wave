import type {
  CrewMember,
  Training,
  TrainingSession,
  TrainingSessionAttendee,
} from "@prisma/client";
import { assertDataScopeAccess } from "../../lib/dataScope.js";
import { resolveTrainingAssignmentStatus } from "../../lib/crewTrainingStatus.js";
import { AppError } from "../../lib/errors.js";
import { sniffCrewDocumentMime } from "../../lib/fileSniff.js";
import {
  ALLOWED_CREW_DOC_MIMES,
  MAX_CREW_DOC_BYTES,
  resolveUploadFullPath,
  unlinkTrainingSessionFile,
  writeTrainingSessionFile,
} from "../../lib/localUploads.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { createCrewMemberDocument } from "../crewMemberDocuments/crewMemberDocuments.service.js";
import type {
  CreateTrainingSessionBody,
  ListTrainingSessionsQuery,
  TrainingSessionResponse,
  UpdateTrainingSessionBody,
  UploadTrainingSessionCertificateBody,
} from "./trainingSessions.schemas.js";

/** Actor con tenant + dataScope + id para uploads/auditoría. */
type Actor = Pick<
  AuthUser,
  | "id"
  | "internalRol"
  | "businessId"
  | "locationId"
  | "areaId"
  | "organizationId"
  | "dataScope"
  | "roleId"
>;

/** Fila con training y asistentes para serializar. */
type SessionRow = TrainingSession & {
  training: Training | null;
  attendees: Array<
    TrainingSessionAttendee & {
      crewMember: Pick<
        CrewMember,
        "id" | "firstName" | "lastName" | "run" | "businessId" | "locationId" | "areaId" | "deletedAt"
      >;
    }
  >;
};

/** Include estándar de lecturas. */
const sessionInclude = {
  training: true,
  attendees: {
    include: {
      crewMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          run: true,
          businessId: true,
          locationId: true,
          areaId: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/** Nombre visible del tripulante. */
function crewDisplayName(crew: {
  firstName: string;
  lastName: string;
}): string {
  return `${crew.firstName} ${crew.lastName}`.trim();
}

/** Serializa sesión → contrato API. */
function toSessionResponse(row: SessionRow): TrainingSessionResponse {
  return {
    id: row.id,
    businessId: row.businessId,
    trainingId: row.trainingId,
    training: row.training
      ? {
          id: row.training.id,
          code: row.training.code,
          name: row.training.name,
          validityMonths: row.training.validityMonths,
          documentTypeId: row.training.documentTypeId,
        }
      : null,
    heldAt: row.heldAt.toISOString(),
    status: row.status,
    notes: row.notes,
    hasCertificate: Boolean(row.filePath),
    fileOriginalName: row.fileOriginalName,
    fileMimeType: row.fileMimeType,
    fileSize: row.fileSize,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedById: row.closedById,
    createdById: row.createdById,
    attendeeCount: row.attendees.length,
    attendees: row.attendees.map((a) => ({
      id: a.id,
      crewMemberId: a.crewMemberId,
      crewMemberName: crewDisplayName(a.crewMember),
      crewMemberRun: a.crewMember.run,
      crewMemberTrainingId: a.crewMemberTrainingId,
      evidenceDocumentId: a.evidenceDocumentId,
      logEntryId: a.logEntryId,
    })),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resuelve businessId de creación. */
function resolveBusinessId(
  actor: Actor,
  bodyBusinessId: string | undefined,
): string {
  if (actor.internalRol === "superadmin") {
    if (!bodyBusinessId) {
      throw new AppError(
        400,
        "validation_error",
        "businessId es requerido para crear la sesión",
      );
    }
    return bodyBusinessId;
  }
  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }
  return actor.businessId;
}

/** Filtro de listado por tenant. */
function listWhere(
  actor: Actor,
  query: ListTrainingSessionsQuery,
): { businessId?: string; trainingId?: string; status?: "draft" | "completed" | "cancelled"; deletedAt: null } {
  const where: {
    businessId?: string;
    trainingId?: string;
    status?: "draft" | "completed" | "cancelled";
    deletedAt: null;
  } = { deletedAt: null };

  if (query.trainingId) where.trainingId = query.trainingId;
  if (query.status) where.status = query.status;

  if (actor.internalRol === "superadmin") {
    if (query.businessId) where.businessId = query.businessId;
  } else {
    if (!actor.businessId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una empresa asignada",
      );
    }
    where.businessId = actor.businessId;
  }
  return where;
}

/** 404 genérico si el actor no ve la empresa de la sesión. */
function assertSessionTenantAccess(actor: Actor, businessId: string): void {
  if (actor.internalRol === "superadmin") return;
  if (!actor.businessId || actor.businessId !== businessId) {
    throw new AppError(
      404,
      "training_session_not_found",
      "Sesión de capacitación no encontrada",
    );
  }
}

/** Carga sesión activa y valida tenant. */
async function loadSessionForActor(
  actor: Actor,
  id: string,
): Promise<SessionRow> {
  const row = await prisma.trainingSession.findFirst({
    where: { id, deletedAt: null },
    include: sessionInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "training_session_not_found",
      "Sesión de capacitación no encontrada",
    );
  }
  assertSessionTenantAccess(actor, row.businessId);
  return row;
}

/** Exige que la sesión siga en borrador. */
function assertDraft(row: TrainingSession): void {
  if (row.status !== "draft") {
    throw new AppError(
      409,
      "training_session_not_draft",
      "Solo se puede editar una sesión en borrador",
    );
  }
}

/**
 * Valida tripulantes: misma empresa, activos, visibles por dataScope.
 * Dedup por id.
 */
async function loadAttendeeCrew(
  actor: Actor,
  businessId: string,
  crewMemberIds: string[],
): Promise<CrewMember[]> {
  const uniqueIds = [...new Set(crewMemberIds)];
  const crews = await prisma.crewMember.findMany({
    where: {
      id: { in: uniqueIds },
      deletedAt: null,
      state: true,
    },
  });
  if (crews.length !== uniqueIds.length) {
    throw new AppError(
      400,
      "crew_member_not_found",
      "Uno o más tripulantes no existen o están inactivos",
    );
  }
  for (const crew of crews) {
    if (crew.businessId !== businessId) {
      throw new AppError(
        400,
        "crew_business_mismatch",
        "Todos los asistentes deben ser de la misma empresa de la sesión",
      );
    }
    assertDataScopeAccess(actor, crew, {
      code: "crew_member_not_found",
      message: "Tripulante no encontrado",
    });
  }
  return crews;
}

/** Calcula expiresAt desde completedAt + validityMonths. */
function resolveExpiresAt(
  completedAt: Date,
  validityMonths: number | null,
): Date | null {
  if (validityMonths == null) return null;
  const expires = new Date(completedAt.getTime());
  expires.setUTCMonth(expires.getUTCMonth() + validityMonths);
  return expires;
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

/** Lista sesiones visibles para el actor. */
export async function listTrainingSessions(
  actor: Actor,
  query: ListTrainingSessionsQuery,
): Promise<{
  items: TrainingSessionResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;
  const [total, rows] = await prisma.$transaction([
    prisma.trainingSession.count({ where }),
    prisma.trainingSession.findMany({
      where,
      include: sessionInclude,
      orderBy: [{ heldAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    items: rows.map(toSessionResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** Detalle por id. */
export async function getTrainingSessionById(
  actor: Actor,
  id: string,
): Promise<TrainingSessionResponse> {
  const row = await loadSessionForActor(actor, id);
  return toSessionResponse(row);
}

/**
 * Crea sesión en borrador con asistentes (1 = individual, N = grupal).
 */
export async function createTrainingSession(
  actor: Actor,
  body: CreateTrainingSessionBody,
): Promise<TrainingSessionResponse> {
  const businessId = resolveBusinessId(actor, body.businessId);

  const training = await prisma.training.findFirst({
    where: { id: body.trainingId, deletedAt: null },
  });
  if (!training || training.businessId !== businessId) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  if (!training.active) {
    throw new AppError(
      400,
      "training_inactive",
      "No se puede usar una capacitación inactiva",
    );
  }
  if (!training.appliesTo.includes("crew")) {
    throw new AppError(
      400,
      "training_not_for_crew",
      "Esta capacitación no aplica a tripulación",
    );
  }

  await loadAttendeeCrew(actor, businessId, body.crewMemberIds);

  const created = await prisma.trainingSession.create({
    data: {
      businessId,
      trainingId: training.id,
      heldAt: new Date(body.heldAt),
      notes: body.notes ?? null,
      status: "draft",
      createdById: actor.id,
      attendees: {
        create: [...new Set(body.crewMemberIds)].map((crewMemberId) => ({
          crewMemberId,
        })),
      },
    },
    include: sessionInclude,
  });

  return toSessionResponse(created);
}

/** Actualiza borrador (fecha, notas, lista de asistentes). */
export async function updateTrainingSession(
  actor: Actor,
  id: string,
  body: UpdateTrainingSessionBody,
): Promise<TrainingSessionResponse> {
  const existing = await loadSessionForActor(actor, id);
  assertDraft(existing);

  if (body.crewMemberIds) {
    await loadAttendeeCrew(actor, existing.businessId, body.crewMemberIds);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (body.crewMemberIds) {
      await tx.trainingSessionAttendee.deleteMany({
        where: { sessionId: id },
      });
      await tx.trainingSessionAttendee.createMany({
        data: [...new Set(body.crewMemberIds)].map((crewMemberId) => ({
          sessionId: id,
          crewMemberId,
        })),
      });
    }

    return tx.trainingSession.update({
      where: { id },
      data: {
        ...(body.heldAt !== undefined
          ? { heldAt: new Date(body.heldAt) }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: sessionInclude,
    });
  });

  return toSessionResponse(updated);
}

/** Sube o reemplaza el acta/PDF de la sesión (solo borrador). */
export async function uploadTrainingSessionCertificate(
  actor: Actor,
  id: string,
  body: UploadTrainingSessionCertificateBody,
): Promise<TrainingSessionResponse> {
  const existing = await loadSessionForActor(actor, id);
  assertDraft(existing);

  const buffer = decodeBase64Content(body.contentBase64);
  if (buffer.length === 0) {
    throw new AppError(400, "empty_file", "El archivo está vacío");
  }
  if (buffer.length > MAX_CREW_DOC_BYTES) {
    throw new AppError(
      400,
      "file_too_large",
      `El archivo supera el máximo de ${MAX_CREW_DOC_BYTES} bytes`,
    );
  }

  const sniffed = sniffCrewDocumentMime(buffer);
  if (!sniffed || !ALLOWED_CREW_DOC_MIMES.has(sniffed)) {
    throw new AppError(
      400,
      "unsupported_mime",
      "Tipo de archivo no permitido para el acta",
    );
  }

  if (existing.filePath) {
    await unlinkTrainingSessionFile(existing.filePath);
  }

  const written = await writeTrainingSessionFile({
    businessId: existing.businessId,
    sessionId: existing.id,
    mimeType: sniffed,
    buffer,
  });

  const updated = await prisma.trainingSession.update({
    where: { id: existing.id },
    data: {
      filePath: written.relativePath,
      fileOriginalName: body.fileName.trim(),
      fileMimeType: sniffed,
      fileSize: written.size,
    },
    include: sessionInclude,
  });

  return toSessionResponse(updated);
}

/**
 * Cierra la sesión: por cada asistente renueva CrewMemberTraining,
 * copia el acta a Documentos y crea entrada en bitácora.
 */
export async function completeTrainingSession(
  actor: Actor,
  id: string,
): Promise<TrainingSessionResponse> {
  const existing = await loadSessionForActor(actor, id);
  assertDraft(existing);

  if (existing.attendees.length === 0) {
    throw new AppError(
      400,
      "attendees_required",
      "La sesión necesita al menos un asistente",
    );
  }
  if (!existing.filePath || !existing.fileOriginalName || !existing.fileMimeType) {
    throw new AppError(
      400,
      "certificate_required",
      "Subí el acta/PDF antes de cerrar la sesión",
    );
  }
  if (!existing.training || existing.training.deletedAt) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  if (!existing.training.documentTypeId) {
    throw new AppError(
      400,
      "training_without_document_type",
      "Esta capacitación no tiene tipo de documento de evidencia configurado",
    );
  }

  const fullPath = resolveUploadFullPath(existing.filePath);
  if (!fullPath) {
    throw new AppError(
      500,
      "certificate_missing",
      "No se encontró el archivo del acta en disco",
    );
  }
  const { readFile } = await import("node:fs/promises");
  const fileBuffer = await readFile(fullPath);
  const contentBase64 = fileBuffer.toString("base64");

  const completedAt = existing.heldAt;
  const expiresAt = resolveExpiresAt(
    completedAt,
    existing.training.validityMonths,
  );
  const status = resolveTrainingAssignmentStatus({
    completedAt,
    expiresAt,
    status: "pending",
  });

  const trainingCode = existing.training.code;
  const trainingName = existing.training.name;
  const documentTypeId = existing.training.documentTypeId;
  const expiresAtIso = expiresAt ? expiresAt.toISOString() : null;

  for (const attendee of existing.attendees) {
    if (attendee.crewMember.deletedAt) {
      throw new AppError(
        400,
        "crew_member_not_found",
        `Tripulante inactivo: ${crewDisplayName(attendee.crewMember)}`,
      );
    }

    const softDeleted = await prisma.crewMemberTraining.findFirst({
      where: {
        crewMemberId: attendee.crewMemberId,
        trainingId: existing.trainingId,
        deletedAt: { not: null },
      },
    });
    const active = await prisma.crewMemberTraining.findFirst({
      where: {
        crewMemberId: attendee.crewMemberId,
        trainingId: existing.trainingId,
        deletedAt: null,
      },
    });

    let assignmentId: string;
    if (active) {
      // Renueva fechas; la evidencia se reemplaza con el acta de esta sesión.
      const updated = await prisma.crewMemberTraining.update({
        where: { id: active.id },
        data: {
          completedAt,
          expiresAt,
          status,
          evidenceDocumentId: null,
        },
      });
      assignmentId = updated.id;
    } else if (softDeleted) {
      const revived = await prisma.crewMemberTraining.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          completedAt,
          expiresAt,
          status,
          evidenceDocumentId: null,
        },
      });
      assignmentId = revived.id;
    } else {
      const created = await prisma.crewMemberTraining.create({
        data: {
          crewMemberId: attendee.crewMemberId,
          trainingId: existing.trainingId,
          completedAt,
          expiresAt,
          status,
        },
      });
      assignmentId = created.id;
    }

    const doc = await createCrewMemberDocument(actor, attendee.crewMemberId, {
      documentTypeId,
      fileName: existing.fileOriginalName,
      mimeType: existing.fileMimeType,
      contentBase64,
      sourceModule: "prevention",
      expiresAt: expiresAtIso,
    });

    await prisma.crewMemberTraining.update({
      where: { id: assignmentId },
      data: { evidenceDocumentId: doc.id },
    });

    const logEntry = await prisma.crewMemberLogEntry.create({
      data: {
        crewMemberId: attendee.crewMemberId,
        kind: "training",
        note: `Capacitación ${trainingCode} — ${trainingName}. Acta: ${existing.fileOriginalName}.`,
        occurredAt: completedAt,
        createdById: actor.id,
        documentId: doc.id,
      },
    });

    await prisma.trainingSessionAttendee.update({
      where: { id: attendee.id },
      data: {
        crewMemberTrainingId: assignmentId,
        evidenceDocumentId: doc.id,
        logEntryId: logEntry.id,
      },
    });
  }

  await prisma.trainingSession.update({
    where: { id: existing.id },
    data: {
      status: "completed",
      closedAt: new Date(),
      closedById: actor.id,
    },
  });

  const refreshed = await loadSessionForActor(actor, id);
  return toSessionResponse(refreshed);
}

/** Cancela (soft) una sesión en borrador. */
export async function cancelTrainingSession(
  actor: Actor,
  id: string,
): Promise<TrainingSessionResponse> {
  const existing = await loadSessionForActor(actor, id);
  assertDraft(existing);

  if (existing.filePath) {
    await unlinkTrainingSessionFile(existing.filePath);
  }

  const updated = await prisma.trainingSession.update({
    where: { id },
    data: {
      status: "cancelled",
      deletedAt: new Date(),
      filePath: null,
      fileOriginalName: null,
      fileMimeType: null,
      fileSize: null,
    },
    include: sessionInclude,
  });

  return toSessionResponse(updated);
}
