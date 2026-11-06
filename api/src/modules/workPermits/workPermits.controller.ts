import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  createWorkPermitResponseSchema,
  getWorkPermitResponseSchema,
  listWorkPermitsResponseSchema,
  submitWorkPermitResponseSchema,
  type CreateWorkPermitBody,
  type ListWorkPermitsQuery,
} from "./workPermits.schemas.js";
import {
  createWorkPermitFromNotice,
  getWorkPermitById,
  listWorkPermits,
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
