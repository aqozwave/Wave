import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  cancelTrainingSessionResponseSchema,
  completeTrainingSessionResponseSchema,
  createTrainingSessionResponseSchema,
  getTrainingSessionResponseSchema,
  listTrainingSessionsResponseSchema,
  updateTrainingSessionResponseSchema,
  uploadTrainingSessionCertificateResponseSchema,
  type CreateTrainingSessionBody,
  type ListTrainingSessionsQuery,
  type UpdateTrainingSessionBody,
  type UploadTrainingSessionCertificateBody,
} from "./trainingSessions.schemas.js";
import {
  cancelTrainingSession,
  completeTrainingSession,
  createTrainingSession,
  getTrainingSessionById,
  listTrainingSessions,
  updateTrainingSession,
  uploadTrainingSessionCertificate,
} from "./trainingSessions.service.js";

/** GET /training-sessions — listado tenant. */
export async function listTrainingSessionsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListTrainingSessionsQuery;
  const result = await listTrainingSessions(req.user, query);
  const body = listTrainingSessionsResponseSchema.parse(result);
  res.status(200).json(body);
}

/** POST /training-sessions — alta borrador. */
export async function createTrainingSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateTrainingSessionBody;
  const created = await createTrainingSession(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "training",
    resourceId: created.id,
    targetLabel: created.training?.code ?? created.id,
    metadata: {
      kind: "training_session",
      trainingId: created.trainingId,
      attendeeCount: created.attendeeCount,
    },
  });
  const out = createTrainingSessionResponseSchema.parse(created);
  res.status(201).json(out);
}

/** GET /training-sessions/:id — detalle. */
export async function getTrainingSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getTrainingSessionById(req.user, id);
  const body = getTrainingSessionResponseSchema.parse(item);
  res.status(200).json(body);
}

/** PATCH /training-sessions/:id — editar borrador. */
export async function updateTrainingSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateTrainingSessionBody;
  const updated = await updateTrainingSession(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "training",
    resourceId: updated.id,
    targetLabel: updated.training?.code ?? updated.id,
    metadata: { kind: "training_session" },
  });
  const out = updateTrainingSessionResponseSchema.parse(updated);
  res.status(200).json(out);
}

/** POST /training-sessions/:id/certificate — sube acta. */
export async function uploadTrainingSessionCertificateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UploadTrainingSessionCertificateBody;
  const updated = await uploadTrainingSessionCertificate(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "training",
    resourceId: updated.id,
    targetLabel: updated.fileOriginalName ?? updated.id,
    metadata: { kind: "training_session_certificate" },
  });
  const out = uploadTrainingSessionCertificateResponseSchema.parse(updated);
  res.status(200).json(out);
}

/** POST /training-sessions/:id/complete — cierra y propaga a fichas. */
export async function completeTrainingSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const completed = await completeTrainingSession(req.user, id);
  auditWrite(req, {
    action: "UPDATE",
    resource: "training",
    resourceId: completed.id,
    targetLabel: completed.training?.code ?? completed.id,
    metadata: {
      kind: "training_session_complete",
      attendeeCount: completed.attendeeCount,
    },
  });
  const out = completeTrainingSessionResponseSchema.parse(completed);
  res.status(200).json(out);
}

/** DELETE /training-sessions/:id — cancela borrador. */
export async function cancelTrainingSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const cancelled = await cancelTrainingSession(req.user, id);
  auditWrite(req, {
    action: "DELETE",
    resource: "training",
    resourceId: cancelled.id,
    targetLabel: cancelled.training?.code ?? cancelled.id,
    metadata: { kind: "training_session_cancel" },
  });
  const out = cancelTrainingSessionResponseSchema.parse(cancelled);
  res.status(200).json(out);
}
