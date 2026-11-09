import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  approveWorkPermitResponseSchema,
  closeWorkPermitResponseSchema,
  createWorkPermitResponseSchema,
  deleteWorkPermitResponseSchema,
  getWorkPermitChecklistResponseSchema,
  getWorkPermitResponseSchema,
  workPermitDocumentResponseSchema,
  listWorkPermitAssignablePeopleResponseSchema,
  listWorkPermitHistoryResponseSchema,
  listWorkPermitPeopleResponseSchema,
  listWorkPermitsResponseSchema,
  putWorkPermitChecklistResponseSchema,
  putWorkPermitPeopleResponseSchema,
  receiveWorkPermitResponseSchema,
  rejectCloseWorkPermitResponseSchema,
  rejectReceiptWorkPermitResponseSchema,
  requestCloseWorkPermitResponseSchema,
  returnWorkPermitResponseSchema,
  submitWorkPermitResponseSchema,
  workPermitRequirementsCheckResponseSchema,
  type CreateWorkPermitBody,
  type ListWorkPermitHistoryQuery,
  type ListWorkPermitsQuery,
  type PutWorkPermitChecklistBody,
  type PutWorkPermitPeopleBody,
  type WorkPermitChecklistStage,
  type WorkPermitRequirementsCheckQuery,
  type WorkPermitReviewNoteBody,
} from "./workPermits.schemas.js";
import {
  approveWorkPermit,
  checkWorkPermitRequirements,
  closeWorkPermit,
  createWorkPermitFromNotice,
  deleteWorkPermitById,
  getWorkPermitById,
  getWorkPermitChecklist,
  getWorkPermitDocument,
  listWorkPermitAssignablePeople,
  listWorkPermitHistory,
  listWorkPermitPeople,
  listWorkPermits,
  putWorkPermitChecklist,
  putWorkPermitPeople,
  receiveWorkPermit,
  rejectCloseWorkPermit,
  rejectReceiptWorkPermit,
  requestCloseWorkPermit,
  returnWorkPermit,
  submitWorkPermit,
} from "./workPermits.service.js";

/** GET /work-permits. */
export async function listWorkPermitsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListWorkPermitsQuery;
  const result = await listWorkPermits(req.user, query);
  res.status(200).json(listWorkPermitsResponseSchema.parse(result));
}

/** GET /work-permits/requirements-check — P13b. */
export async function checkWorkPermitRequirementsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as WorkPermitRequirementsCheckQuery;
  const result = await checkWorkPermitRequirements(req.user, query);
  res
    .status(200)
    .json(workPermitRequirementsCheckResponseSchema.parse(result));
}

/** POST /work-permits — crear desde aviso. */
export async function createWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateWorkPermitBody;
  const result = await createWorkPermitFromNotice(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.workNotice.code}`,
  });
  res.status(201).json(createWorkPermitResponseSchema.parse(result));
}

/** GET /work-permits/:id. */
export async function getWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getWorkPermitById(req.user, req.params.id as string);
  res.status(200).json(getWorkPermitResponseSchema.parse(result));
}

/** DELETE /work-permits/:id — soft-delete (aviso → cancelled). */
export async function deleteWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteWorkPermitById(req.user, req.params.id as string);
  auditWrite(req, {
    action: "DELETE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · delete`,
  });
  res.status(200).json(deleteWorkPermitResponseSchema.parse(result));
}

/** GET /work-permits/:id/history — bitácora del PT. */
export async function listWorkPermitHistoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListWorkPermitHistoryQuery;
  const result = await listWorkPermitHistory(
    req.user,
    req.params.id as string,
    query,
  );
  res.status(200).json(listWorkPermitHistoryResponseSchema.parse(result));
}

/** GET /work-permits/:id/assignable-people — readiness pack + exigencias faena. */
export async function listWorkPermitAssignablePeopleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listWorkPermitAssignablePeople(
    req.user,
    req.params.id as string,
  );
  res
    .status(200)
    .json(listWorkPermitAssignablePeopleResponseSchema.parse(result));
}

/** GET /work-permits/:id/people. */
export async function listWorkPermitPeopleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listWorkPermitPeople(req.user, req.params.id as string);
  res.status(200).json(listWorkPermitPeopleResponseSchema.parse(result));
}

/** PUT /work-permits/:id/people — set de personal. */
export async function putWorkPermitPeopleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as PutWorkPermitPeopleBody;
  const result = await putWorkPermitPeople(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: req.params.id as string,
    targetLabel: `people · ${result.items.length}`,
    metadata: { personIds: body.personIds },
  });
  res.status(200).json(putWorkPermitPeopleResponseSchema.parse(result));
}

/** GET /work-permits/:id/checklist. */
export async function getWorkPermitChecklistHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const stage = (req.query.stage as WorkPermitChecklistStage) || "contractor";
  const result = await getWorkPermitChecklist(
    req.user,
    req.params.id as string,
    stage,
  );
  res.status(200).json(getWorkPermitChecklistResponseSchema.parse(result));
}

/** PUT /work-permits/:id/checklist. */
export async function putWorkPermitChecklistHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as PutWorkPermitChecklistBody;
  const result = await putWorkPermitChecklist(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: req.params.id as string,
    targetLabel: `checklist · ${body.stage ?? "contractor"}`,
    metadata: { answers: body.answers.length },
  });
  res.status(200).json(putWorkPermitChecklistResponseSchema.parse(result));
}

/** POST /work-permits/:id/submit — a aprobación. */
export async function submitWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await submitWorkPermit(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · submit`,
  });
  res.status(200).json(submitWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/approve — Prevención aprueba. */
export async function approveWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await approveWorkPermit(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · approve`,
  });
  res.status(200).json(approveWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/return — Prevención devuelve. */
export async function returnWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as WorkPermitReviewNoteBody;
  const result = await returnWorkPermit(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · return`,
    metadata: { reviewNote: body.reviewNote },
  });
  res.status(200).json(returnWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/receive — capitán recibe a bordo. */
export async function receiveWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await receiveWorkPermit(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · receive`,
  });
  res.status(200).json(receiveWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/reject-receipt — capitán no autoriza. */
export async function rejectReceiptWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as WorkPermitReviewNoteBody;
  const result = await rejectReceiptWorkPermit(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · reject-receipt`,
    metadata: { reviewNote: body.reviewNote },
  });
  res.status(200).json(rejectReceiptWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/request-close — pedir verificación de cierre. */
export async function requestCloseWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await requestCloseWorkPermit(
    req.user,
    req.params.id as string,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · request-close`,
  });
  res.status(200).json(requestCloseWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/close — capitán cierra el trabajo. */
export async function closeWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await closeWorkPermit(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · close`,
  });
  res.status(200).json(closeWorkPermitResponseSchema.parse(result));
}

/** POST /work-permits/:id/reject-close — capitán marca sin cierre. */
export async function rejectCloseWorkPermitHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as WorkPermitReviewNoteBody;
  const result = await rejectCloseWorkPermit(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "workPermit",
    resourceId: result.id,
    targetLabel: `${result.code} · reject-close`,
    metadata: { reviewNote: body.reviewNote },
  });
  res.status(200).json(rejectCloseWorkPermitResponseSchema.parse(result));
}

/** GET /work-permits/:id/document — ficha imprimible + firmas (P6c). */
export async function getWorkPermitDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getWorkPermitDocument(req.user, req.params.id as string);
  res.status(200).json(workPermitDocumentResponseSchema.parse(result));
}
