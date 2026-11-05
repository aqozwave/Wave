import { createReadStream } from "node:fs";
import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createAccreditationDocumentResponseSchema,
  listAccreditationDocumentsResponseSchema,
} from "../accreditationDocuments/accreditationDocuments.schemas.js";
import { getAccreditationResponseSchema } from "../accreditations/accreditations.schemas.js";
import {
  contractorPortalSummaryResponseSchema,
  createContractorPersonResponseSchema,
  createContractorResponseSchema,
  deleteContractorPersonResponseSchema,
  deleteContractorResponseSchema,
  getContractorResponseSchema,
  inviteContractorUserResponseSchema,
  listContractorPeopleResponseSchema,
  listContractorUsersResponseSchema,
  listContractorsResponseSchema,
  updateContractorPersonResponseSchema,
  updateContractorResponseSchema,
  type CreateContractorBody,
  type CreateContractorPersonBody,
  type CreateContractorPortalDocumentBody,
  type InviteContractorUserBody,
  type ListContractorPeopleQuery,
  type ListContractorUsersQuery,
  type ListContractorsQuery,
  type UpdateContractorBody,
  type UpdateContractorPersonBody,
} from "./contractors.schemas.js";
import {
  createContractor,
  createContractorPerson,
  createMyContractorAccreditationDocument,
  deleteContractor,
  deleteContractorPerson,
  getContractorById,
  getContractorPortalSummary,
  getMyContractorAccreditation,
  inviteContractorUser,
  listContractorPeople,
  listContractorUsers,
  listContractors,
  listMyContractorAccreditationDocuments,
  resolveMyContractorAccreditationDocumentFile,
  submitMyContractorAccreditation,
  updateContractor,
  updateContractorPerson,
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

/** GET /contractors/me/summary — portal E3b del usuario externo. */
export async function getContractorPortalSummaryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getContractorPortalSummary(req.user);
  res.status(200).json(contractorPortalSummaryResponseSchema.parse(result));
}

/** GET /contractors/me/accreditation — HAB de la org del portal. */
export async function getMyContractorAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await getMyContractorAccreditation(req.user);
  res.status(200).json(getAccreditationResponseSchema.parse(result));
}

/** GET /contractors/me/accreditation/documents — pack company. */
export async function listMyContractorAccreditationDocumentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await listMyContractorAccreditationDocuments(req.user);
  res.status(200).json(listAccreditationDocumentsResponseSchema.parse(result));
}

/** POST /contractors/me/accreditation/documents — upload. */
export async function createMyContractorAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateContractorPortalDocumentBody;
  const created = await createMyContractorAccreditationDocument(req.user, body);
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorOrgDocument",
    resourceId: created.id,
    targetLabel: `${created.documentType.code} · ${created.originalName}`,
    metadata: { accreditationId: created.accreditationId, via: "portal" },
  });
  res
    .status(201)
    .json(createAccreditationDocumentResponseSchema.parse(created));
}

/** GET /contractors/me/accreditation/documents/:documentId/download */
export async function downloadMyContractorAccreditationDocumentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const file = await resolveMyContractorAccreditationDocumentFile(
    req.user,
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

/** POST /contractors/me/accreditation/submit */
export async function submitMyContractorAccreditationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await submitMyContractorAccreditation(req.user);
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorAccreditation",
    resourceId: result.id,
    targetLabel: `${result.code} · submit`,
    metadata: { status: result.status, via: "portal" },
  });
  res.status(200).json(getAccreditationResponseSchema.parse(result));
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

/** GET /contractors/:id/users — invitados de la org (P9b). */
export async function listContractorUsersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListContractorUsersQuery;
  const result = await listContractorUsers(
    req.user,
    req.params.id as string,
    query,
  );
  res.status(200).json(listContractorUsersResponseSchema.parse(result));
}

/** POST /contractors/:id/users — invitar / vincular (P9b). */
export async function inviteContractorUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as InviteContractorUserBody;
  const result = await inviteContractorUser(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "user",
    resourceId: result.id,
    targetLabel: `${result.email} · org ${req.params.id as string}`,
  });
  res.status(201).json(inviteContractorUserResponseSchema.parse(result));
}

/** GET /contractors/:id/people — personal de la org. */
export async function listContractorPeopleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const query = req.query as unknown as ListContractorPeopleQuery;
  const result = await listContractorPeople(
    req.user,
    req.params.id as string,
    query,
  );
  res.status(200).json(listContractorPeopleResponseSchema.parse(result));
}

/** POST /contractors/:id/people — alta persona. */
export async function createContractorPersonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as CreateContractorPersonBody;
  const result = await createContractorPerson(
    req.user,
    req.params.id as string,
    body,
  );
  auditWrite(req, {
    action: "CREATE",
    resource: "contractorPerson",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.fullName}`,
  });
  res.status(201).json(createContractorPersonResponseSchema.parse(result));
}

/** PATCH /contractors/:id/people/:personId. */
export async function updateContractorPersonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const body = req.body as UpdateContractorPersonBody;
  const result = await updateContractorPerson(
    req.user,
    req.params.id as string,
    req.params.personId as string,
    body,
  );
  auditWrite(req, {
    action: "UPDATE",
    resource: "contractorPerson",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.fullName}`,
    metadata: { fields: safeChangedFields(body) },
  });
  res.status(200).json(updateContractorPersonResponseSchema.parse(result));
}

/** DELETE /contractors/:id/people/:personId — soft delete. */
export async function deleteContractorPersonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AppError(401, "unauthorized", "Token requerido");
  const result = await deleteContractorPerson(
    req.user,
    req.params.id as string,
    req.params.personId as string,
  );
  auditWrite(req, {
    action: "DELETE",
    resource: "contractorPerson",
    resourceId: result.id,
    targetLabel: `${result.rut} · ${result.fullName}`,
  });
  res.status(200).json(deleteContractorPersonResponseSchema.parse(result));
}
