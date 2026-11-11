import { createReadStream } from "node:fs";
import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createAccreditationDocumentResponseSchema,
  createAccreditationPersonDocumentResponseSchema,
  deleteAccreditationDocumentResponseSchema,
  deleteAccreditationPersonDocumentResponseSchema,
  listAccreditationDocumentsResponseSchema,
  listAccreditationPersonDocumentsResponseSchema,
  validateAccreditationDocumentResponseSchema,
  validateAccreditationPersonDocumentResponseSchema,
  type CreateAccreditationDocumentBody,
  type ValidateAccreditationDocumentBody,
} from "./accreditationDocuments.schemas.js";
import {
  createAccreditationDocument,
  createAccreditationPersonDocument,
  deleteAccreditationDocument,
  deleteAccreditationPersonDocument,
  listAccreditationDocuments,
  listAccreditationPersonDocuments,
  resolveAccreditationDocumentFile,
  resolveAccreditationPersonDocumentFile,
  validateAccreditationDocument,
  validateAccreditationPersonDocument,
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
    metadata: { accreditationId: created.accreditationId },
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
    metadata: {
      accreditationId: updated.accreditationId,
      fields: safeChangedFields(body),
    },
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
    metadata: { accreditationId: deleted.accreditationId },
  });
  res
    .status(200)
    .json(deleteAccreditationDocumentResponseSchema.parse(deleted));
}

/** GET /accreditations/:id/people/:personId/documents */
export async function listAccreditationPersonDocumentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listAccreditationPersonDocuments(
    req.user,
    req.params.id as string,
    req.params.personId as string,
  );
  res
    .status(200)
    .json(listAccreditationPersonDocumentsResponseSchema.parse(result));
}

/** POST /accreditations/:id/people/:personId/documents */
export async function createAccreditationPersonDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateAccreditationDocumentBody;
  const created = await createAccreditationPersonDocument(
    req.user,
    req.params.id as string,
    req.params.personId as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorPersonDocument",
    resourceId: created.id,
    targetLabel: `${created.documentType.code} · ${created.originalName}`,
    metadata: { accreditationId: created.accreditationId },
  });
  res
    .status(201)
    .json(createAccreditationPersonDocumentResponseSchema.parse(created));
}

/** GET …/people/:personId/documents/:documentId/download */
export async function downloadAccreditationPersonDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const file = await resolveAccreditationPersonDocumentFile(
    req.user,
    req.params.id as string,
    req.params.personId as string,
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

/** POST …/people/:personId/documents/:documentId/validate */
export async function validateAccreditationPersonDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as ValidateAccreditationDocumentBody;
  const updated = await validateAccreditationPersonDocument(
    req.user,
    req.params.id as string,
    req.params.personId as string,
    req.params.documentId as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorPersonDocument",
    resourceId: updated.id,
    targetLabel: `${updated.documentType.code} · ${body.status}`,
    metadata: {
      accreditationId: updated.accreditationId,
      fields: safeChangedFields(body),
    },
  });
  res
    .status(200)
    .json(validateAccreditationPersonDocumentResponseSchema.parse(updated));
}

/** DELETE …/people/:personId/documents/:documentId */
export async function deleteAccreditationPersonDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const deleted = await deleteAccreditationPersonDocument(
    req.user,
    req.params.id as string,
    req.params.personId as string,
    req.params.documentId as string,
  );
  auditWrite(req, {
    action: "DELETE",
    resource: "contractorPersonDocument",
    resourceId: deleted.id,
    targetLabel: `${deleted.documentType.code} · ${deleted.originalName}`,
    metadata: { accreditationId: deleted.accreditationId },
  });
  res
    .status(200)
    .json(deleteAccreditationPersonDocumentResponseSchema.parse(deleted));
}
