import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createContractorResponseSchema,
  deleteContractorResponseSchema,
  getContractorResponseSchema,
  listContractorsResponseSchema,
  updateContractorResponseSchema,
  type CreateContractorBody,
  type ListContractorsQuery,
  type UpdateContractorBody,
} from "./contractors.schemas.js";
import {
  createContractor,
  deleteContractor,
  getContractorById,
  listContractors,
  updateContractor,
} from "./contractors.service.js";

/** GET /contractors — listado paginado. */
export async function listContractorsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListContractorsQuery;
  const result = await listContractors(req.user, query);
  res.status(200).json(listContractorsResponseSchema.parse(result));
}

/** POST /contractors — alta. */
export async function createContractorHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateContractorBody;
  const result = await createContractor(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorOrganization",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.name}`,
  });
  res.status(201).json(createContractorResponseSchema.parse(result));
}

/** GET /contractors/:id — detalle. */
export async function getContractorHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getContractorById(req.user, req.params.id as string);
  res.status(200).json(getContractorResponseSchema.parse(result));
}

/** PATCH /contractors/:id — editar / desactivar (active). */
export async function updateContractorHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdateContractorBody;
  const result = await updateContractor(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorOrganization",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.name}`,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateContractorResponseSchema.parse(result));
}

/** DELETE /contractors/:id — soft delete. */
export async function deleteContractorHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteContractor(req.user, req.params.id as string);
  auditWrite(req, {
    action: "DELETE",
    resource: "contractorOrganization",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.name}`,
  });
  res.status(200).json(deleteContractorResponseSchema.parse(result));
}
