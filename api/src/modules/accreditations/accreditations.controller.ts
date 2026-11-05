import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { auditWrite } from "../activityLogs/activityLogs.service.js";
import {
  createAccreditationResponseSchema,
  getAccreditationResponseSchema,
  listAccreditationsResponseSchema,
  type AccreditationReviewNoteBody,
  type CreateAccreditationBody,
  type ListAccreditationsQuery,
} from "./accreditations.schemas.js";
import {
  approveAccreditation,
  createAccreditation,
  getAccreditationById,
  listAccreditations,
  rejectAccreditation,
  returnAccreditation,
  submitAccreditation,
} from "./accreditations.service.js";

/** GET /accreditations — bandeja. */
export async function listAccreditationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListAccreditationsQuery;
  const result = await listAccreditations(req.user, query);
  res.status(200).json(listAccreditationsResponseSchema.parse(result));
}

/** POST /accreditations — solicitar documentación. */
export async function createAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateAccreditationBody;
  const result = await createAccreditation(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · ${result.organization.rut}`,
  });
  res.status(201).json(createAccreditationResponseSchema.parse(result));
}

/** GET /accreditations/:id. */
export async function getAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getAccreditationById(req.user, req.params.id as string);
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}

/** POST /accreditations/:id/submit. */
export async function submitAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await submitAccreditation(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · submit`,
    metadata: { status: result.status },
  });
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}

/** POST /accreditations/:id/approve. */
export async function approveAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await approveAccreditation(req.user, req.params.id as string);
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · approve`,
    metadata: { status: result.status },
  });
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}

/** POST /accreditations/:id/return. */
export async function returnAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as AccreditationReviewNoteBody;
  const result = await returnAccreditation(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · return`,
    metadata: { status: result.status },
  });
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}

/** POST /accreditations/:id/reject. */
export async function rejectAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as AccreditationReviewNoteBody;
  const result = await rejectAccreditation(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · reject`,
    metadata: { status: result.status },
  });
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}
