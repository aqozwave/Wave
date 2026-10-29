import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createDocumentTypeResponseSchema,
  deleteDocumentTypeResponseSchema,
  getDocumentTypeResponseSchema,
  listDocumentTypesResponseSchema,
  updateDocumentTypeResponseSchema,
  type CreateDocumentTypeBody,
  type ListDocumentTypesQuery,
  type UpdateDocumentTypeBody,
} from "./documentTypes.schemas.js";
import {
  createDocumentType,
  deleteDocumentType,
  getDocumentTypeById,
  listDocumentTypes,
  updateDocumentType,
} from "./documentTypes.service.js";

/** GET /document-types */
export async function listDocumentTypesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListDocumentTypesQuery;
  const result = await listDocumentTypes(req.user, query);
  res.status(200).json(listDocumentTypesResponseSchema.parse(result));
}

/** POST /document-types */
export async function createDocumentTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateDocumentTypeBody;
  const result = await createDocumentType(req.user, body);
  res.status(201).json(createDocumentTypeResponseSchema.parse(result));
}

/** GET /document-types/:id */
export async function getDocumentTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getDocumentTypeById(req.user, req.params.id as string);
  res.status(200).json(getDocumentTypeResponseSchema.parse(result));
}

/** PATCH /document-types/:id */
export async function updateDocumentTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdateDocumentTypeBody;
  const result = await updateDocumentType(
    req.user,
    req.params.id as string,
    body,
  );
  res.status(200).json(updateDocumentTypeResponseSchema.parse(result));
}

/** DELETE /document-types/:id */
export async function deleteDocumentTypeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteDocumentType(req.user, req.params.id as string);
  res.status(200).json(deleteDocumentTypeResponseSchema.parse(result));
}
