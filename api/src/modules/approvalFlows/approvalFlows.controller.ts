import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createApprovalFlowResponseSchema,
  getApprovalFlowResponseSchema,
  listApprovalFlowsResponseSchema,
  type CreateApprovalFlowBody,
  type ListApprovalFlowsQuery,
} from "./approvalFlows.schemas.js";
import {
  createApprovalFlow,
  getApprovalFlowById,
  listApprovalFlows,
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
