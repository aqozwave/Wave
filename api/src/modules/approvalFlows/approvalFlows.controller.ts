import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createApprovalFlowResponseSchema,
  createApprovalFlowStageResponseSchema,
  deleteApprovalFlowResponseSchema,
  deleteApprovalFlowStageResponseSchema,
  getApprovalFlowResponseSchema,
  listApprovalFlowsResponseSchema,
  updateApprovalFlowResponseSchema,
  updateApprovalFlowStageResponseSchema,
  type CreateApprovalFlowBody,
  type CreateApprovalFlowStageBody,
  type ListApprovalFlowsQuery,
  type UpdateApprovalFlowBody,
  type UpdateApprovalFlowStageBody,
} from "./approvalFlows.schemas.js";
import {
  addApprovalFlowStage,
  createApprovalFlow,
  deleteApprovalFlow,
  deleteApprovalFlowStage,
  getApprovalFlowById,
  listApprovalFlows,
  updateApprovalFlow,
  updateApprovalFlowStage,
} from "./approvalFlows.service.js";

/** GET /approval-flows — listado P16 (Superadmin). */
export async function listApprovalFlowsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListApprovalFlowsQuery;
  const result = await listApprovalFlows(req.user, query);
  res.status(200).json(listApprovalFlowsResponseSchema.parse(result));
}

/** GET /approval-flows/:id — detalle con etapas. */
export async function getApprovalFlowHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const result = await getApprovalFlowById(req.user, id);
  res.status(200).json(getApprovalFlowResponseSchema.parse(result));
}

/** POST /approval-flows — copia editable (P16m). */
export async function createApprovalFlowHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateApprovalFlowBody;
  const result = await createApprovalFlow(req.user, body);
  res.status(201).json(createApprovalFlowResponseSchema.parse(result));
}

/** PATCH /approval-flows/:id — nombre/desc/activo. */
export async function updateApprovalFlowHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const body = req.body as UpdateApprovalFlowBody;
  const result = await updateApprovalFlow(req.user, id, body);
  res.status(200).json(updateApprovalFlowResponseSchema.parse(result));
}

/** DELETE /approval-flows/:id — soft-delete personalizado. */
export async function deleteApprovalFlowHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const result = await deleteApprovalFlow(req.user, id);
  res.status(200).json(deleteApprovalFlowResponseSchema.parse(result));
}

/** POST /approval-flows/:id/stages — agregar etapa. */
export async function addApprovalFlowStageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id } = req.params as { id: string };
  const body = req.body as CreateApprovalFlowStageBody;
  const result = await addApprovalFlowStage(req.user, id, body);
  res.status(201).json(createApprovalFlowStageResponseSchema.parse(result));
}

/** PATCH /approval-flows/:id/stages/:stageId. */
export async function updateApprovalFlowStageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id, stageId } = req.params as { id: string; stageId: string };
  const body = req.body as UpdateApprovalFlowStageBody;
  const result = await updateApprovalFlowStage(req.user, id, stageId, body);
  res.status(200).json(updateApprovalFlowStageResponseSchema.parse(result));
}

/** DELETE /approval-flows/:id/stages/:stageId. */
export async function deleteApprovalFlowStageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const { id, stageId } = req.params as { id: string; stageId: string };
  const result = await deleteApprovalFlowStage(req.user, id, stageId);
  res.status(200).json(deleteApprovalFlowStageResponseSchema.parse(result));
}
