import type {
  CrewMemberDocument,
  CrewMemberTraining,
  Training,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import {
  daysUntilExpiry,
  getTrainingExpiryWarningDays,
  resolveTrainingAssignmentStatus,
} from "../../lib/crewTrainingStatus.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import { createCrewMemberDocument } from "../crewMemberDocuments/crewMemberDocuments.service.js";
import type {
  CreateCrewMemberTrainingBody,
  CrewMemberTrainingResponse,
  UpdateCrewMemberTrainingBody,
  UploadCrewMemberTrainingEvidenceBody,
} from "./crewMemberTrainings.schemas.js";

/** Actor mínimo tenant (CRUD asignación). */
type Actor = Pick<AuthUser, "internalRol" | "businessId">;

/** Actor con rol para uploadBy del tipo de evidencia. */
type UploadActor = Pick<
  AuthUser,
  "id" | "internalRol" | "businessId" | "roleId"
>;

/** Fila con capacitación y evidencia incluidas. */
type AssignmentWithTraining = CrewMemberTraining & {
  training: Training | null;
  evidenceDocument: CrewMemberDocument | null;
};

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

/**
 * Calcula expiresAt: body explícito gana; si no, completedAt + validityMonths.
 * Si no hay completedAt o el catálogo no define meses → null.
 */
function resolveExpiresAt(opts: {
  completedAt: Date | null;
  validityMonths: number | null;
  explicitExpiresAt: Date | null | undefined;
}): Date | null {
  if (opts.explicitExpiresAt !== undefined) {
    return opts.explicitExpiresAt;
  }
  if (!opts.completedAt || opts.validityMonths == null) {
    return null;
  }
  const expires = new Date(opts.completedAt.getTime());
  expires.setUTCMonth(expires.getUTCMonth() + opts.validityMonths);
  return expires;
}

/** Valida que la evidencia exista, sea del tripulante y no esté borrada. */
async function assertEvidenceBelongsToCrew(
  crewMemberId: string,
  evidenceDocumentId: string | null,
): Promise<void> {
  if (!evidenceDocumentId) return;
  const doc = await prisma.crewMemberDocument.findFirst({
    where: {
      id: evidenceDocumentId,
      crewMemberId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!doc) {
    throw new AppError(
      400,
      "evidence_document_invalid",
      "El documento de evidencia no existe en el expediente de este tripulante",
    );
  }
}

/** Serializa asignación → contrato (status recalculado). */
function toAssignmentResponse(
  row: AssignmentWithTraining,
): CrewMemberTrainingResponse {
  const warningDays = getTrainingExpiryWarningDays();
  const status = resolveTrainingAssignmentStatus(row, { warningDays });
  const training =
    row.training && row.training.deletedAt === null
      ? {
          id: row.training.id,
          code: row.training.code,
          name: row.training.name,
          validityMonths: row.training.validityMonths,
          appliesTo: row.training.appliesTo.filter(
            (t): t is "crew" | "external_person" =>
              t === "crew" || t === "external_person",
          ),
          documentTypeId: row.training.documentTypeId,
          active: row.training.active,
        }
      : null;

  const evidence =
    row.evidenceDocument && row.evidenceDocument.deletedAt === null
      ? {
          id: row.evidenceDocument.id,
          originalName: row.evidenceDocument.originalName,
          mimeType: row.evidenceDocument.mimeType,
          expiresAt: row.evidenceDocument.expiresAt
            ? row.evidenceDocument.expiresAt.toISOString()
            : null,
          documentTypeId: row.evidenceDocument.documentTypeId,
        }
      : null;

  return {
    id: row.id,
    crewMemberId: row.crewMemberId,
    trainingId: row.trainingId,
    training,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    status,
    evidenceDocumentId: row.evidenceDocumentId,
    evidenceDocument: evidence,
    daysUntilExpiry: daysUntilExpiry(row.expiresAt),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Include estándar para serializar. */
const assignmentInclude = {
  training: true,
  evidenceDocument: true,
} as const;

/** Lista capacitaciones de un tripulante (tenant-aware). */
export async function listCrewMemberTrainings(
  actor: Actor,
  crewMemberId: string,
): Promise<{ items: CrewMemberTrainingResponse[]; total: number }> {
  await loadCrewForActor(actor, crewMemberId);
  const rows = await prisma.crewMemberTraining.findMany({
    where: { crewMemberId, deletedAt: null },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    include: assignmentInclude,
  });
  return {
    items: rows.map(toAssignmentResponse),
    total: rows.length,
  };
}

/** Detalle de una asignación del tripulante. */
export async function getCrewMemberTrainingById(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberTrainingResponse> {
  await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberTraining.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: assignmentInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_training_not_found",
      "Asignación de capacitación no encontrada",
    );
  }

  // Persistimos status recalculado si cambió.
  const nextStatus = resolveTrainingAssignmentStatus(row);
  if (nextStatus !== row.status) {
    const updated = await prisma.crewMemberTraining.update({
      where: { id: row.id },
      data: { status: nextStatus },
      include: assignmentInclude,
    });
    return toAssignmentResponse(updated);
  }

  return toAssignmentResponse(row);
}

/**
 * Alta de asignación. La capacitación debe ser de la misma empresa,
 * activa y aplicable a tripulación (appliesTo incluye crew).
 */
export async function createCrewMemberTraining(
  actor: Actor,
  crewMemberId: string,
  body: CreateCrewMemberTrainingBody,
): Promise<CrewMemberTrainingResponse> {
  const crew = await loadCrewForActor(actor, crewMemberId);

  const training = await prisma.training.findFirst({
    where: { id: body.trainingId, deletedAt: null },
  });
  if (!training) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  if (training.active === false) {
    throw new AppError(
      400,
      "training_inactive",
      "No se puede asignar una capacitación inactiva",
    );
  }
  if (training.businessId !== crew.businessId) {
    throw new AppError(
      400,
      "training_business_mismatch",
      "La capacitación no pertenece a la misma empresa del tripulante",
    );
  }
  if (!training.appliesTo.includes("crew")) {
    throw new AppError(
      400,
      "training_not_for_crew",
      "Esta capacitación no aplica a tripulación",
    );
  }

  const evidenceDocumentId =
    body.evidenceDocumentId === undefined ? null : body.evidenceDocumentId;
  await assertEvidenceBelongsToCrew(crewMemberId, evidenceDocumentId);

  const completedAt =
    body.completedAt === undefined || body.completedAt === null
      ? null
      : new Date(body.completedAt);
  const explicitExpiresAt =
    body.expiresAt === undefined
      ? undefined
      : body.expiresAt === null
        ? null
        : new Date(body.expiresAt);
  const expiresAt = resolveExpiresAt({
    completedAt,
    validityMonths: training.validityMonths,
    explicitExpiresAt,
  });
  const status = resolveTrainingAssignmentStatus({
    completedAt,
    expiresAt,
    status: "pending",
  });

  const existingActive = await prisma.crewMemberTraining.findFirst({
    where: {
      crewMemberId,
      trainingId: body.trainingId,
      deletedAt: null,
    },
  });
  if (existingActive) {
    throw new AppError(
      409,
      "duplicate_crew_member_training",
      "Este tripulante ya tiene asignada esa capacitación",
    );
  }

  // Revive soft-delete si existía el par.
  const softDeleted = await prisma.crewMemberTraining.findFirst({
    where: {
      crewMemberId,
      trainingId: body.trainingId,
      deletedAt: { not: null },
    },
  });

  const row = softDeleted
    ? await prisma.crewMemberTraining.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          completedAt,
          expiresAt,
          status,
          evidenceDocumentId,
        },
        include: assignmentInclude,
      })
    : await prisma.crewMemberTraining.create({
        data: {
          crewMemberId,
          trainingId: body.trainingId,
          completedAt,
          expiresAt,
          status,
          evidenceDocumentId,
        },
        include: assignmentInclude,
      });

  return toAssignmentResponse(row);
}

/** Actualiza fechas/estado/evidencia de una asignación. */
export async function updateCrewMemberTraining(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
  body: UpdateCrewMemberTrainingBody,
): Promise<CrewMemberTrainingResponse> {
  await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberTraining.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: assignmentInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_training_not_found",
      "Asignación de capacitación no encontrada",
    );
  }

  if (body.evidenceDocumentId !== undefined) {
    await assertEvidenceBelongsToCrew(crewMemberId, body.evidenceDocumentId);
  }

  const nextCompletedAt =
    body.completedAt !== undefined
      ? body.completedAt
        ? new Date(body.completedAt)
        : null
      : row.completedAt;

  // expiresAt explícito gana; si solo cambió completedAt, recalcula con el catálogo.
  let nextExpiresAt: Date | null;
  if (body.expiresAt !== undefined) {
    nextExpiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  } else if (body.completedAt !== undefined) {
    nextExpiresAt = resolveExpiresAt({
      completedAt: nextCompletedAt,
      validityMonths: row.training?.validityMonths ?? null,
      explicitExpiresAt: undefined,
    });
  } else {
    nextExpiresAt = row.expiresAt;
  }

  const status = resolveTrainingAssignmentStatus({
    completedAt: nextCompletedAt,
    expiresAt: nextExpiresAt,
    status: body.status ?? row.status,
  });

  const updated = await prisma.crewMemberTraining.update({
    where: { id: row.id },
    data: {
      completedAt: nextCompletedAt,
      expiresAt: nextExpiresAt,
      status,
      ...(body.evidenceDocumentId !== undefined
        ? { evidenceDocumentId: body.evidenceDocumentId }
        : {}),
    },
    include: assignmentInclude,
  });

  return toAssignmentResponse(updated);
}

/** Soft-delete de una asignación. */
export async function deleteCrewMemberTraining(
  actor: Actor,
  crewMemberId: string,
  assignmentId: string,
): Promise<CrewMemberTrainingResponse> {
  await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberTraining.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: assignmentInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_training_not_found",
      "Asignación de capacitación no encontrada",
    );
  }

  const deleted = await prisma.crewMemberTraining.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
    include: assignmentInclude,
  });

  return toAssignmentResponse(deleted);
}

/**
 * Sube evidencia documental de una asignación.
 * Usa Training.documentTypeId; linkea evidenceDocumentId.
 * Si la asignación seguía pending, marca completedAt=now y recalcula vigencia.
 */
export async function uploadCrewMemberTrainingEvidence(
  actor: UploadActor,
  crewMemberId: string,
  assignmentId: string,
  body: UploadCrewMemberTrainingEvidenceBody,
): Promise<CrewMemberTrainingResponse> {
  await loadCrewForActor(actor, crewMemberId);
  const row = await prisma.crewMemberTraining.findFirst({
    where: { id: assignmentId, crewMemberId, deletedAt: null },
    include: assignmentInclude,
  });
  if (!row) {
    throw new AppError(
      404,
      "crew_member_training_not_found",
      "Asignación de capacitación no encontrada",
    );
  }
  if (!row.training || row.training.deletedAt) {
    throw new AppError(404, "training_not_found", "Capacitación no encontrada");
  }
  if (!row.training.documentTypeId) {
    throw new AppError(
      400,
      "training_without_document_type",
      "Esta capacitación no tiene tipo de documento de evidencia configurado",
    );
  }

  // Preferir expiresAt del body; si no, el de la asignación (para tipos con Vence).
  const expiresAtIso =
    body.expiresAt !== undefined
      ? body.expiresAt
      : row.expiresAt
        ? row.expiresAt.toISOString()
        : null;

  const createdDoc = await createCrewMemberDocument(actor, crewMemberId, {
    documentTypeId: row.training.documentTypeId,
    fileName: body.fileName,
    mimeType: body.mimeType,
    contentBase64: body.contentBase64,
    sourceModule: "prevention",
    expiresAt: expiresAtIso,
  });

  const nextCompletedAt = row.completedAt ?? new Date();
  const nextExpiresAt = resolveExpiresAt({
    completedAt: nextCompletedAt,
    validityMonths: row.training.validityMonths,
    explicitExpiresAt:
      body.expiresAt !== undefined
        ? body.expiresAt
          ? new Date(body.expiresAt)
          : null
        : row.expiresAt !== null
          ? row.expiresAt
          : undefined,
  });
  const status = resolveTrainingAssignmentStatus({
    completedAt: nextCompletedAt,
    expiresAt: nextExpiresAt,
    status: row.status,
  });

  const updated = await prisma.crewMemberTraining.update({
    where: { id: row.id },
    data: {
      evidenceDocumentId: createdDoc.id,
      completedAt: nextCompletedAt,
      expiresAt: nextExpiresAt,
      status,
    },
    include: assignmentInclude,
  });

  return toAssignmentResponse(updated);
}
