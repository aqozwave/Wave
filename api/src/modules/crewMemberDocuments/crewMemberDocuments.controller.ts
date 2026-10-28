import { createReadStream } from "node:fs";
import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createCrewMemberDocumentResponseSchema,
  deleteCrewMemberDocumentResponseSchema,
  listCrewMemberDocumentsResponseSchema,
  type CreateCrewMemberDocumentBody,
} from "./crewMemberDocuments.schemas.js";
import {
  createCrewMemberDocument,
  deleteCrewMemberDocument,
  listCrewMemberDocuments,
  resolveCrewMemberDocumentFile,
} from "./crewMemberDocuments.service.js";

/** GET /crew-members/:id/documents */
export async function listCrewMemberDocumentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const result = await listCrewMemberDocuments(req.user, id);
  res.status(200).json(listCrewMemberDocumentsResponseSchema.parse(result));
}

/** POST /crew-members/:id/documents — body JSON + base64. */
export async function createCrewMemberDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as CreateCrewMemberDocumentBody;
  const created = await createCrewMemberDocument(req.user, id, body);
  res.status(201).json(createCrewMemberDocumentResponseSchema.parse(created));
}

/** GET /crew-members/:id/documents/:documentId/download — stream. */
export async function downloadCrewMemberDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, documentId } = req.params as {
    id: string;
    documentId: string;
  };
  const file = await resolveCrewMemberDocumentFile(req.user, id, documentId);

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.originalName)}"`,
  );
  createReadStream(file.fullPath).pipe(res);
}

/** DELETE /crew-members/:id/documents/:documentId */
export async function deleteCrewMemberDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id, documentId } = req.params as {
    id: string;
    documentId: string;
  };
  const deleted = await deleteCrewMemberDocument(req.user, id, documentId);
  res.status(200).json(deleteCrewMemberDocumentResponseSchema.parse(deleted));
}
