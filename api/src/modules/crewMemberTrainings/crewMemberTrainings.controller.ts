import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createCrewMemberTrainingResponseSchema,
  deleteCrewMemberTrainingResponseSchema,
  getCrewMemberTrainingResponseSchema,
  listCrewMemberTrainingsResponseSchema,
  updateCrewMemberTrainingResponseSchema,
  uploadCrewMemberTrainingEvidenceResponseSchema,
  type CreateCrewMemberTrainingBody,
  type UpdateCrewMemberTrainingBody,
  type UploadCrewMemberTrainingEvidenceBody,
} from "./crewMemberTrainings.schemas.js";
import {
  createCrewMemberTraining,
  deleteCrewMemberTraining,
  getCrewMemberTrainingById,
  listCrewMemberTrainings,
  updateCrewMemberTraining,
  uploadCrewMemberTrainingEvidence,
} from "./crewMemberTrainings.service.js";

/** GET /crew-members/:id/trainings — listado de la ficha. */
export async function listCrewMemberTrainingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await listCrewMemberTrainings(req.user, id);
  res.status(200).json(listCrewMemberTrainingsResponseSchema.parse(result));
}

/** GET /crew-members/:id/trainings/:assignmentId — detalle. */
export async function getCrewMemberTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const item = await getCrewMemberTrainingById(req.user, id, assignmentId);
  res.status(200).json(getCrewMemberTrainingResponseSchema.parse(item));
}

/** POST /crew-members/:id/trainings — alta. */
export async function createCrewMemberTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberTrainingBody;
  const created = await createCrewMemberTraining(req.user, id, body);
  // resource=crewMember para que entre en la bitácora de la ficha.
  auditWrite(req, {
    action: "CREATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: created.training
      ? `${created.training.code} · ${created.training.name}`
      : created.trainingId,
    metadata: {
      kind: "crew_member_training",
      assignmentId: created.id,
      trainingId: created.trainingId,
      crewMemberId: id,
    },
  });
  res.status(201).json(createCrewMemberTrainingResponseSchema.parse(created));
}

/** PATCH /crew-members/:id/trainings/:assignmentId — fechas/estado/evidencia. */
export async function updateCrewMemberTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const body = req.body as UpdateCrewMemberTrainingBody;
  const updated = await updateCrewMemberTraining(
    req.user,
    id,
    assignmentId,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: updated.training
      ? `${updated.training.code} · ${updated.training.name}`
      : updated.trainingId,
    metadata: {
      kind: "crew_member_training",
      assignmentId: updated.id,
      trainingId: updated.trainingId,
      crewMemberId: id,
      fields: safeChangedFields(body),
    },
  });
  res.status(200).json(updateCrewMemberTrainingResponseSchema.parse(updated));
}

/** DELETE /crew-members/:id/trainings/:assignmentId — soft delete. */
export async function deleteCrewMemberTrainingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const deleted = await deleteCrewMemberTraining(req.user, id, assignmentId);
  auditWrite(req, {
    action: "DELETE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: deleted.training
      ? `${deleted.training.code} · ${deleted.training.name}`
      : deleted.trainingId,
    metadata: {
      kind: "crew_member_training",
      assignmentId: deleted.id,
      trainingId: deleted.trainingId,
      crewMemberId: id,
    },
  });
  res.status(200).json(deleteCrewMemberTrainingResponseSchema.parse(deleted));
}

/** POST /crew-members/:id/trainings/:assignmentId/evidence — archivo + link. */
export async function uploadCrewMemberTrainingEvidenceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, assignmentId } = req.params as {
    id: string;
    assignmentId: string;
  };
  const body = req.body as UploadCrewMemberTrainingEvidenceBody;
  const updated = await uploadCrewMemberTrainingEvidence(
    req.user,
    id,
    assignmentId,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "crewMember",
    resourceId: id,
    targetLabel: updated.training
      ? `${updated.training.code} · ${updated.training.name}`
      : updated.trainingId,
    metadata: {
      kind: "crew_member_training_evidence",
      assignmentId: updated.id,
      trainingId: updated.trainingId,
      crewMemberId: id,
      evidenceDocumentId: updated.evidenceDocumentId,
    },
  });
  res
    .status(201)
    .json(uploadCrewMemberTrainingEvidenceResponseSchema.parse(updated));
}
