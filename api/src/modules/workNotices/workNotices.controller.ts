import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  createWorkNoticeResponseSchema,
  deleteWorkNoticeResponseSchema,
  getWorkNoticeResponseSchema,
  listWorkNoticesResponseSchema,
  type CreateWorkNoticeBody,
  type ListWorkNoticesQuery,
} from "./workNotices.schemas.js";
import {
  createWorkNotice,
  deleteWorkNoticeById,
  getWorkNoticeById,
  listWorkNotices,
} from "./workNotices.service.js";

/** GET /work-notices — bandeja AT1. */
export async function listWorkNoticesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListWorkNoticesQuery;
  const result = await listWorkNotices(req.user, query);
  res.status(200).json(listWorkNoticesResponseSchema.parse(result));
}

/** POST /work-notices — crear aviso (AT2). */
export async function createWorkNoticeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateWorkNoticeBody;
  const result = await createWorkNotice(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "workNotice",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.organization.rut}`,
  });
  res.status(201).json(createWorkNoticeResponseSchema.parse(result));
}

/** GET /work-notices/:id. */
export async function getWorkNoticeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getWorkNoticeById(req.user, req.params.id as string);
  res.status(200).json(getWorkNoticeResponseSchema.parse(result));
}

/** DELETE /work-notices/:id — soft-delete (+ PT vinculado si hay). */
export async function deleteWorkNoticeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteWorkNoticeById(req.user, req.params.id as string);
  auditWrite(req, {
    action: "DELETE",
    resource: "workNotice",
    resourceId: result.id,
    targetLabel: `${result.code} · delete`,
  });
  res.status(200).json(deleteWorkNoticeResponseSchema.parse(result));
}
