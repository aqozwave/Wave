import { createReadStream } from "node:fs";
import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createAccreditationDocumentResponseSchema,
  deleteAccreditationDocumentResponseSchema,
  listAccreditationDocumentsResponseSchema,
  validateAccreditationDocumentResponseSchema,
  type CreateAccreditationDocumentBody,
  type ValidateAccreditationDocumentBody,
} from "./accreditationDocuments.schemas.js";
import {
  createAccreditationDocument,
  deleteAccreditationDocument,
  listAccreditationDocuments,
  resolveAccreditationDocumentFile,
  validateAccreditationDocument,
} from "./accreditationDocuments.service.js";

/** GET /accreditations/:id/documents — checklist pack company. */
export async function listAccreditationDocumentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listAccreditationDocuments(
    req.user,
    req.params.id as string,
  );
  res.status(200).json(listAccreditationDocumentsResponseSchema.parse(result));
}

/** POST /accreditations/:id/documents — upload base64. */
export async function createAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateAccreditationDocumentBody;
  const created = await createAccreditationDocument(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorOrgDocument",
    resourceId: created.id,
    targetLabel: `${created.documentType.code} · ${created.originalName}`,
  });
  res
    .status(201)
    .json(createAccreditationDocumentResponseSchema.parse(created));
}

/** GET /accreditations/:id/documents/:documentId/download */
export async function downloadAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const file = await resolveAccreditationDocumentFile(
    req.user,
    req.params.id as string,
    req.params.documentId as string,
  );
  const inlineRaw = (req.query as { inline?: string }).inline;
  const asInline = inlineRaw === "1" || inlineRaw === "true";
  const disposition = asInline ? "inline" : "attachment";

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${encodeURIComponent(file.originalName)}"`,
  );
  createReadStream(file.fullPath).pipe(res);
}

/** POST /accreditations/:id/documents/:documentId/validate */
export async function validateAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as ValidateAccreditationDocumentBody;
  const updated = await validateAccreditationDocument(
    req.user,
    req.params.id as string,
    req.params.documentId as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorOrgDocument",
    resourceId: updated.id,
    targetLabel: `${updated.documentType.code} · ${body.status}`,
    metadata: { fields: safeChangedFields(body) },
  });
  res
    .status(200)
    .json(validateAccreditationDocumentResponseSchema.parse(updated));
}

/** DELETE /accreditations/:id/documents/:documentId */
export async function deleteAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const deleted = await deleteAccreditationDocument(
    req.user,
    req.params.id as string,
    req.params.documentId as string,
  );
  auditWrite(req, {
    action: "DELETE",
    resource: "contractorOrgDocument",
    resourceId: deleted.id,
    targetLabel: `${deleted.documentType.code} · ${deleted.originalName}`,
  });
  res
    .status(200)
    .json(deleteAccreditationDocumentResponseSchema.parse(deleted));
}
