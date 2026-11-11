import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  auditWrite,
  safeChangedFields,
} from "../activityLogs/activityLogs.service.js";
import {
  createBusinessResponseSchema,
  deleteBusinessResponseSchema,
  getBusinessResponseSchema,
  listBusinessesResponseSchema,
  listBusinessModulesResponseSchema,
  patchBusinessModuleResponseSchema,
  pingBusinessModuleResponseSchema,
  updateBusinessResponseSchema,
  type CreateBusinessBody,
  type ListBusinessesQuery,
  type PatchBusinessModuleBody,
  type UpdateBusinessBody,
} from "./businesses.schemas.js";
import {
  createBusiness,
  deleteBusinessById,
  getBusinessById,
  listBusinesses,
  listBusinessModules,
  setBusinessModule,
  updateBusiness,
} from "./businesses.service.js";

/**
 * GET /businesses — listado scoped por tenant.
 * Exige `authenticate` antes.
 */
export async function listBusinessesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const query = req.query as unknown as ListBusinessesQuery;
  const result = await listBusinesses(req.user, query);
  const body = listBusinessesResponseSchema.parse(result);
  res.status(200).json(body);
}

/**
 * POST /businesses — alta (solo superadmin en la ruta).
 */
export async function createBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as CreateBusinessBody;
  const created = await createBusiness(body);
  auditWrite(req, {
    action: "CREATE",
    resource: "business",
    resourceId: created.id,
    targetLabel: created.name,
  });
  const out = createBusinessResponseSchema.parse(created);
  res.status(201).json(out);
}

/**
 * GET /businesses/:id — detalle con acceso tenant.
 */
export async function getBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const item = await getBusinessById(req.user, id);
  const body = getBusinessResponseSchema.parse(item);
  res.status(200).json(body);
}

/**
 * PATCH /businesses/:id — edición (superadmin todo; admin contacto).
 */
export async function updateBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id } = req.params as { id: string };
  const body = req.body as UpdateBusinessBody;
  const updated = await updateBusiness(req.user, id, body);
  auditWrite(req, {
    action: "UPDATE",
    resource: "business",
    resourceId: updated.id,
    targetLabel: updated.name,
    metadata: { fields: safeChangedFields(body) },
  });
  const out = updateBusinessResponseSchema.parse(updated);
  res.status(200).json(out);
}

/**
 * DELETE /businesses/:id — soft delete (solo superadmin en la ruta).
 */
export async function deleteBusinessHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const deleted = await deleteBusinessById(id);
  auditWrite(req, {
    action: "DELETE",
    resource: "business",
    resourceId: deleted.id,
    targetLabel: deleted.name,
  });
  const out = deleteBusinessResponseSchema.parse(deleted);
  res.status(200).json(out);
}

/**
 * GET /businesses/:id/modules/:key — sonda P0 de requireModule.
 * Si el middleware pasó, el módulo está enabled.
 */
export async function pingBusinessModuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id, key } = req.params as {
    id: string;
    key: "contractors" | "work_permits" | "trainings";
  };
  const body = pingBusinessModuleResponseSchema.parse({
    businessId: id,
    key,
    enabled: true as const,
  });
  res.status(200).json(body);
}

/**
 * GET /businesses/:id/modules — interruptores Prevención (S6 lectura).
 */
export async function listBusinessModulesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await listBusinessModules(id);
  res.status(200).json(listBusinessModulesResponseSchema.parse(result));
}

/**
 * PATCH /businesses/:id/modules/:key — prende/apaga (solo superadmin en ruta).
 */
export async function patchBusinessModuleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const { id, key } = req.params as {
    id: string;
    key: "contractors" | "work_permits" | "trainings";
  };
  const body = req.body as PatchBusinessModuleBody;
  const result = await setBusinessModule(id, key, body.enabled, req.user.id);

  auditWrite(req, {
    action: "UPDATE",
    resource: "business",
    resourceId: id,
    targetLabel: `module:${key}`,
    metadata: {
      moduleKey: key,
      enabled: body.enabled,
      cascadedOff: result.cascadedOff,
    },
  });

  res.status(200).json(patchBusinessModuleResponseSchema.parse(result));
}
