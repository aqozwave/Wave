import { Prisma, type WorkPermitSignatureKind } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import {
  applyDataScopeToWhere,
  assertDataScopeAccess,
} from "../../lib/dataScope.js";
import { AppError } from "../../lib/errors.js";
import {
  PERMISSION_ACTION,
  PERMISSION_RESOURCE,
} from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import {
  evaluateCompanyPack,
  evaluatePersonPack,
} from "../accreditations/accreditations.service.js";
import { enqueueWorkPermitCreatedNotifications } from "../notificationOutbox/workPermitNotification.service.js";
import { actorHasPermission } from "../roles/roles.service.js";
import type {
  CreateWorkPermitBody,
  ListWorkPermitHistoryQuery,
  ListWorkPermitsQuery,
  PutWorkPermitChecklistBody,
  PutWorkPermitPeopleBody,
  WorkPermitChecklistStage,
  WorkPermitDigitalSignatureBody,
  WorkPermitDocumentResponse,
  WorkPermitRequirementsCheckQuery,
  WorkPermitResponse,
  WorkPermitReviewNoteBody,
} from "./workPermits.schemas.js";
import {
  resolveWorkPermitFlowPolicy,
  type FlowSnapshot,
  type WorkPermitFlowPolicy,
} from "./workPermitFlowPolicy.js";

/** Actor con id, tenant, org y alcance de nave/área. */
type Actor = Pick<
  AuthUser,
  | "id"
  | "internalRol"
  | "roleId"
  | "businessId"
  | "organizationId"
  | "locationId"
  | "areaId"
  | "dataScope"
>;

/** Include para serializar PT. */
const permitInclude = {
  workNotice: { select: { id: true, code: true, status: true, deletedAt: true } },
  organization: {
    select: {
      id: true,
      name: true,
      rut: true,
      deletedAt: true,
      contactEmail: true,
    },
  },
  permitType: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, name: true } },
} as const;

type PermitRow = Prisma.WorkPermitGetPayload<{ include: typeof permitInclude }>;

/** YYYY-MM-DD. */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Serializa PT → contrato. */
function toWorkPermitResponse(row: PermitRow): WorkPermitResponse {
  return {
    id: row.id,
    businessId: row.businessId,
    code: row.code,
    workNoticeId: row.workNoticeId,
    workNotice: {
      id: row.workNotice.id,
      code: row.workNotice.code,
    },
    organizationId: row.organizationId,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      rut: row.organization.rut,
    },
    permitTypeId: row.permitTypeId,
    permitType: {
      id: row.permitType.id,
      code: row.permitType.code,
      name: row.permitType.name,
    },
    locationId: row.locationId,
    location: {
      id: row.location.id,
      name: row.location.name,
    },
    scheduledDate: toDateOnly(row.scheduledDate),
    description: row.description,
    status: row.status,
    reviewNote: row.reviewNote,
    requirementsSnapshot: row.requirementsSnapshot ?? null,
    approvalFlowId: row.approvalFlowId,
    approvalFlowSnapshot: parseApprovalFlowSnapshot(row.approvalFlowSnapshot),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shape congelado del flujo en el PT. */
type ApprovalFlowSnapshot = {
  id: string;
  code: string;
  name: string;
  stages: Array<{
    key: string;
    label: string;
    position: number;
    actor: string;
    moment: string;
    requiresSignature: boolean;
    mandatory: boolean;
  }>;
};

/** Parsea JSON del snapshot; null si vacío o inválido. */
function parseApprovalFlowSnapshot(
  value: Prisma.JsonValue | null | undefined,
): ApprovalFlowSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.code !== "string" ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.stages)
  ) {
    return null;
  }
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    stages: raw.stages
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === "object" && s !== null && !Array.isArray(s),
      )
      .map((s) => ({
        key: String(s.key ?? ""),
        label: String(s.label ?? ""),
        position: Number(s.position ?? 0),
        actor: String(s.actor ?? ""),
        moment: String(s.moment ?? ""),
        requiresSignature: Boolean(s.requiresSignature),
        mandatory: s.mandatory !== false,
      }))
      .filter((s) => s.key.length > 0),
  };
}

/**
 * Resuelve flujo default del tipo (o EST de la empresa) y arma snapshot.
 */
async function resolveApprovalFlowSnapshot(
  businessId: string,
  permitTypeId: string,
): Promise<{ flowId: string | null; snapshot: ApprovalFlowSnapshot | null }> {
  const permitType = await prisma.permitType.findFirst({
    where: { id: permitTypeId, deletedAt: null },
    select: {
      defaultApprovalFlowId: true,
      defaultApprovalFlow: {
        select: {
          id: true,
          code: true,
          name: true,
          deletedAt: true,
          active: true,
          stages: {
            orderBy: { position: "asc" },
            select: {
              key: true,
              label: true,
              position: true,
              actor: true,
              moment: true,
              requiresSignature: true,
              mandatory: true,
            },
          },
        },
      },
    },
  });

  let flow = permitType?.defaultApprovalFlow ?? null;
  if (!flow || flow.deletedAt || !flow.active) {
    flow = await prisma.approvalFlow.findFirst({
      where: {
        businessId,
        code: "EST",
        isSystem: true,
        deletedAt: null,
        active: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        deletedAt: true,
        active: true,
        stages: {
          orderBy: { position: "asc" },
          select: {
            key: true,
            label: true,
            position: true,
            actor: true,
            moment: true,
            requiresSignature: true,
            mandatory: true,
          },
        },
      },
    });
  }

  if (!flow) {
    return { flowId: null, snapshot: null };
  }

  return {
    flowId: flow.id,
    snapshot: {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      stages: flow.stages.map((s) => ({
        key: s.key,
        label: s.label,
        position: s.position,
        actor: s.actor,
        moment: s.moment,
        requiresSignature: s.requiresSignature,
        mandatory: s.mandatory,
      })),
    },
  };
}

/**
 * POST /work-permits/:id/refresh-approval-flow
 * Reaplica el flujo default actual del tipo (PTs abiertos).
 * Útil si se cambió el flujo del tipo después de crear el PT.
 */
export async function refreshWorkPermitApprovalFlow(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  assertStaffNotContractor(actor);

  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status === "closed" || existing.status === "no_closure") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      "No se puede cambiar el flujo de un permiso ya cerrado",
    );
  }

  const { flowId, snapshot } = await resolveApprovalFlowSnapshot(
    existing.businessId,
    existing.permitTypeId,
  );
  if (!flowId || !snapshot) {
    throw new AppError(
      400,
      "approval_flow_missing",
      "El tipo no tiene un flujo de aprobación activo",
    );
  }

  const policy = resolveWorkPermitFlowPolicy(snapshot);
  /** Si el nuevo flujo no tiene recepción y el PT quedó en to_receive, destapar. */
  const nextStatus =
    existing.status === "to_receive" && !policy.hasReceiveStage
      ? "active"
      : existing.status;

  const updated = await prisma.workPermit.update({
    where: { id },
    data: {
      approvalFlowId: flowId,
      approvalFlowSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      status: nextStatus,
      ...(nextStatus !== existing.status ? { reviewNote: null } : {}),
    },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}

/**
 * Aprobar/devolver es solo staff del tenant (no portal contratista).
 */
function assertStaffNotContractor(actor: Actor): void {
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "Solo Prevención puede aprobar o devolver el permiso",
    );
  }
}

/** Opciones de upsert: registro automático o firma digital (pad). */
type UpsertSignatureOpts = {
  note?: string | null;
  /** Si viene, exige pad + aceptación y congela ese nombre. */
  digital?: WorkPermitDigitalSignatureBody;
};

/** Exigencia de firma previa antes de avanzar/cerrar. */
type RequiredSignature = {
  kind: WorkPermitSignatureKind;
  label: string;
  /** true = debe tener trazo PNG + acceptedAt (Prevención/capitán). */
  digital: boolean;
};

/**
 * Bloquea la transición si faltan firmas previas del ciclo.
 * Sin firmas no se pide cierre ni se cierra el trabajo.
 */
async function assertPriorSignatures(
  workPermitId: string,
  required: RequiredSignature[],
): Promise<void> {
  const rows = await prisma.workPermitSignature.findMany({
    where: {
      workPermitId,
      kind: { in: required.map((r) => r.kind) },
    },
  });
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  const missing: string[] = [];

  for (const req of required) {
    const row = byKind.get(req.kind);
    if (!row) {
      missing.push(req.label);
      continue;
    }
    if (req.digital && (!row.signatureImage || !row.acceptedAt)) {
      missing.push(`${req.label} (sin firma manuscrita)`);
    }
  }

  if (missing.length > 0) {
    throw new AppError(
      409,
      "work_permit_signatures_required",
      `Faltan firmas para continuar: ${missing.join(", ")}. No se puede pedir cierre ni cerrar el trabajo sin las firmas previas.`,
    );
  }
}

/** Firmas digitales previas a pedir/cerrar (Prevención + capitán a bordo). */
const SIGNATURES_BEFORE_CLOSE: RequiredSignature[] = [
  {
    kind: "prevention_approve",
    label: "Aprobación Prevención",
    digital: true,
  },
  {
    kind: "captain_receive",
    label: "Autorización a bordo",
    digital: true,
  },
];

/** Además, al cerrar debe existir el pedido de cierre. */
const SIGNATURES_BEFORE_CAPTAIN_CLOSE: RequiredSignature[] = [
  ...SIGNATURES_BEFORE_CLOSE,
  {
    kind: "contractor_request_close",
    label: "Solicitud de cierre",
    digital: false,
  },
];

/** Política del snapshot congelado del PT. */
function flowPolicyFromRow(row: {
  approvalFlowSnapshot: Prisma.JsonValue | null;
}): WorkPermitFlowPolicy {
  return resolveWorkPermitFlowPolicy(
    parseApprovalFlowSnapshot(row.approvalFlowSnapshot) as FlowSnapshot | null,
  );
}

/**
 * Firmas exigidas antes de pedir cierre / cerrar, según si el flujo tiene recepción.
 */
function signaturesBeforeRequestClose(
  policy: WorkPermitFlowPolicy,
): RequiredSignature[] {
  if (policy.hasReceiveStage) return SIGNATURES_BEFORE_CLOSE;
  return [
    {
      kind: "prevention_approve",
      label: "Aprobación Prevención",
      digital: true,
    },
  ];
}

/** Firmas exigidas al cerrar según flujo. */
function signaturesBeforeFinalClose(
  policy: WorkPermitFlowPolicy,
): RequiredSignature[] {
  const base = signaturesBeforeRequestClose(policy);
  if (policy.hasRequestCloseStage) {
    return [
      ...base,
      {
        kind: "contractor_request_close",
        label: "Solicitud de cierre",
        digital: false,
      },
    ];
  }
  return base;
}

/**
 * Quién puede ejecutar el cierre final según el flujo.
 * Prevención → update; capitán → receive.
 */
async function assertCloseActorAllowed(
  actor: Actor,
  policy: WorkPermitFlowPolicy,
): Promise<void> {
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "El portal contratista no cierra el permiso",
    );
  }

  if (policy.closeActor === "prevention") {
    const ok = await actorHasPermission(
      actor,
      PERMISSION_RESOURCE.WORK_PERMITS,
      PERMISSION_ACTION.UPDATE,
    );
    if (!ok) {
      throw new AppError(
        403,
        "forbidden",
        "Este flujo lo cierra Prevención (no el capitán)",
      );
    }
    return;
  }

  const ok = await actorHasPermission(
    actor,
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.RECEIVE,
  );
  if (!ok) {
    throw new AppError(
      403,
      "forbidden",
      "Este flujo lo cierra el capitán a bordo",
    );
  }
}
/**
 * Upsert firma de un hito del PT (documento P6).
 * Con digital: guarda trazo PNG + acceptedAt; sin digital: solo actor/fecha.
 */
async function upsertWorkPermitSignature(
  workPermitId: string,
  kind: WorkPermitSignatureKind,
  actorId: string,
  opts?: UpsertSignatureOpts,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: actorId, deletedAt: null },
    select: { firstName: true, lastName: true, email: true },
  });
  const fallbackName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : "Usuario";
  const signerName = opts?.digital?.signerName.trim() || fallbackName;
  const signatureImage = opts?.digital?.signatureImage ?? null;
  const acceptedAt = opts?.digital ? new Date() : null;
  const note = opts?.note?.trim() || null;
  const now = new Date();

  await prisma.workPermitSignature.upsert({
    where: {
      workPermitId_kind: { workPermitId, kind },
    },
    create: {
      workPermitId,
      kind,
      signedById: actorId,
      signerName,
      signatureImage,
      acceptedAt,
      note,
      signedAt: now,
    },
    update: {
      signedById: actorId,
      signerName,
      signatureImage,
      acceptedAt,
      note,
      signedAt: now,
    },
  });
}

/**
 * Acceso a un PT: superadmin OK; contratista solo su org;
 * dataScope location/area → nave/área; resto staff → empresa.
 */
function assertPermitAccess(
  actor: Actor,
  row: { businessId: string; organizationId: string; locationId: string },
): void {
  assertDataScopeAccess(
    actor,
    {
      businessId: row.businessId,
      organizationId: row.organizationId,
      locationId: row.locationId,
    },
    { code: "work_permit_not_found", message: "Permiso no encontrado" },
  );
}

/** Where listado (contratista / dataScope / filtros). */
function listWhere(
  actor: Actor,
  query: ListWorkPermitsQuery,
): Prisma.WorkPermitWhereInput {
  const base: Prisma.WorkPermitWhereInput = { deletedAt: null };

  if (query.status) base.status = query.status;

  if (query.search && query.search.length > 0) {
    base.OR = [
      { code: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      {
        organization: {
          name: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        workNotice: { code: { contains: query.search, mode: "insensitive" } },
      },
    ];
  }

  if (query.organizationId && !actor.organizationId) {
    base.organizationId = query.organizationId;
  }

  if (actor.internalRol === "superadmin" || actor.dataScope === "all") {
    if (query.businessId) return { ...base, businessId: query.businessId };
    return base;
  }

  return applyDataScopeToWhere(actor, base, {
    locationField: "locationId",
    organizationField: "organizationId",
  });
}

/** Genera PT-NNNN. */
async function nextWorkPermitCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const last = await tx.workPermit.findFirst({
    where: { code: { startsWith: "PT-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const match = /^PT-(\d+)$/.exec(last.code);
    if (match) next = Number(match[1]) + 1;
  }
  return `PT-${String(next).padStart(4, "0")}`;
}

/** GET /work-permits. */
export async function listWorkPermits(
  actor: Actor,
  query: ListWorkPermitsQuery,
): Promise<{
  items: WorkPermitResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = listWhere(actor, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.workPermit.findMany({
      where,
      include: permitInclude,
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.workPermit.count({ where }),
  ]);

  return {
    items: rows.map(toWorkPermitResponse),
    total,
    page: query.page,
    limit: query.limit,
  };
}

/** GET /work-permits/:id. */
export async function getWorkPermitById(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  const row = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, row);
  return toWorkPermitResponse(row);
}

/**
 * DELETE /work-permits/:id — soft-delete del PT y del aviso origen.
 * Así no queda el aviso acumulado en bandeja (cancelled + deletedAt).
 */
export async function deleteWorkPermitById(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  const row = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!row || row.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, row);
  await assertBusinessModuleEnabled(row.businessId, "work_permits");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.workNotice.update({
      where: { id: row.workNoticeId },
      data: { status: "cancelled", deletedAt: now },
    });
    return tx.workPermit.update({
      where: { id: row.id },
      data: { deletedAt: now },
      include: permitInclude,
    });
  });

  return toWorkPermitResponse(updated);
}

/** Estado de verificación de una exigencia (P13b). */
type RequirementCheckStatus =
  | "ok"
  | "later"
  | "missing"
  | "not_applicable";

/** Ítem serializado del check. */
type RequirementCheckItem = {
  requirementId: string;
  key: string;
  kind: "document" | "training" | "checklist";
  scope: "company" | "person" | "permit";
  moment: "before" | "closure";
  mandatory: boolean;
  label: string;
  status: RequirementCheckStatus;
  detail: string | null;
};

/** Resultado completo del requirements-check. */
type RequirementsCheckResult = {
  organizationId: string;
  organization: { id: string; name: string; rut: string };
  permitTypeId: string;
  permitType: { id: string; code: string; name: string };
  accreditation: { id: string; code: string; status: string } | null;
  summary: {
    ok: number;
    later: number;
    missing: number;
    notApplicable: number;
  };
  items: RequirementCheckItem[];
  canCreate: boolean;
};

/**
 * Evalúa exigencias de empresa al crear el PT (R-09 / R-11).
 * Persona/capacitación/checklist → later; cierre → later.
 */
export async function checkWorkPermitRequirements(
  actor: Actor,
  query: WorkPermitRequirementsCheckQuery,
): Promise<RequirementsCheckResult> {
  const org = await prisma.contractorOrganization.findFirst({
    where: { id: query.organizationId, deletedAt: null },
  });
  if (!org) {
    throw new AppError(
      404,
      "contractor_not_found",
      "Organización no encontrada",
    );
  }
  // Check sin locationId: solo tenant/org (el PT se crea desde el aviso).
  if (actor.internalRol !== "superadmin") {
    if (actor.organizationId) {
      if (actor.organizationId !== org.id) {
        throw new AppError(
          404,
          "contractor_not_found",
          "Organización no encontrada",
        );
      }
    } else if (!actor.businessId || actor.businessId !== org.businessId) {
      throw new AppError(
        404,
        "contractor_not_found",
        "Organización no encontrada",
      );
    }
  }
  await assertBusinessModuleEnabled(org.businessId, "work_permits");

  const permitType = await prisma.permitType.findFirst({
    where: {
      id: query.permitTypeId,
      businessId: org.businessId,
      deletedAt: null,
      active: true,
    },
  });
  if (!permitType) {
    throw new AppError(
      404,
      "permit_type_not_found",
      "Tipo de permiso no encontrado",
    );
  }

  const hab = await prisma.contractorAccreditation.findFirst({
    where: { organizationId: org.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, status: true },
  });

  const requirements = await prisma.permitTypeRequirement.findMany({
    where: { permitTypeId: permitType.id, active: true },
    include: {
      documentType: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ moment: "asc" }, { kind: "asc" }, { key: "asc" }],
  });

  /** Pack empresa completo (aunque la HAB esté approved a mano). */
  let packComplete = false;
  let packOk = 0;
  let packTotal = 0;
  if (hab) {
    const pack = await evaluateCompanyPack(org.businessId, hab.id);
    packComplete = pack.complete;
    packOk = pack.ok;
    packTotal = pack.total;
  }

  const items: RequirementCheckItem[] = requirements.map((req) => {
    const base = {
      requirementId: req.id,
      key: req.key,
      kind: req.kind,
      scope: req.scope,
      moment: req.moment,
      mandatory: req.mandatory,
      label: req.label,
    };

    if (req.moment === "closure") {
      return { ...base, status: "later" as const, detail: "Se verifica al cierre" };
    }
    if (req.scope === "person") {
      return {
        ...base,
        status: "later" as const,
        detail: "Al asignar personal",
      };
    }
    if (req.kind === "training") {
      return {
        ...base,
        status: "later" as const,
        detail: "Capacitaciones (paso posterior)",
      };
    }
    if (req.kind === "checklist") {
      return {
        ...base,
        status: "later" as const,
        detail: "Lo completa el contratista",
      };
    }

    // kind=document · scope=company
    if (!hab) {
      return {
        ...base,
        status: "missing" as const,
        detail: "Sin habilitación",
      };
    }
    if (hab.status !== "approved") {
      return {
        ...base,
        status: "missing" as const,
        detail:
          packComplete && packTotal > 0
            ? `${hab.code} pendiente de aprobación (pack ${packOk}/${packTotal} OK) — Prevención debe Aprobar la HAB`
            : `${hab.code} · ${hab.status} (pack ${packOk}/${packTotal})`,
      };
    }

    /** Pack empresa (matriz HAB): sí bloquea crear si incompleto. */
    if (req.accreditationScope === "company") {
      if (packTotal === 0) {
        return {
          ...base,
          status: "missing" as const,
          detail: "Pack empresa sin tipos configurados",
        };
      }
      if (!packComplete) {
        return {
          ...base,
          status: "missing" as const,
          detail: `${packOk} de ${packTotal} vigentes`,
        };
      }
      return {
        ...base,
        status: "ok" as const,
        detail: `${packOk} de ${packTotal} vigentes`,
      };
    }

    /**
     * Doc empresa puntual (ej. procedimiento) o mal tipado como company:
     * es exigencia del trabajo, no del pack HAB. No bloquea crear el PT;
     * el contratista lo completa en el permiso y Prevención valida.
     */
    if (req.documentTypeId) {
      return {
        ...base,
        status: "later" as const,
        detail:
          "Exigencia del trabajo: lo completa el contratista en el permiso",
      };
    }

    return {
      ...base,
      status: "not_applicable" as const,
      detail: "Exigencia sin documento configurado",
    };
  });

  /**
   * Siempre exigir pack empresa completo al crear PT (aunque el tipo no tenga
   * exigencia «pack»). UUID fijo solo para el ítem sintético de UI.
   */
  const hasPackExigencia = requirements.some(
    (r) =>
      r.kind === "document" &&
      r.scope === "company" &&
      r.moment === "before" &&
      r.accreditationScope === "company",
  );
  if (!hasPackExigencia) {
    /** Pack docs vs estado HAB: mensajes distintos (validar docs ≠ aprobar HAB). */
    let packStatus: "ok" | "missing" = "missing";
    let packDetail: string;
    let packLabel = "Documentos del pack empresa";
    if (!hab) {
      packDetail = "Sin habilitación";
    } else if (hab.status !== "approved") {
      packLabel = "Habilitación aprobada";
      packDetail =
        packComplete && packTotal > 0
          ? `${hab.code} pendiente de aprobación (pack ${packOk}/${packTotal} OK) — Prevención debe Aprobar la HAB`
          : `${hab.code} · ${hab.status} (pack ${packOk}/${packTotal})`;
    } else if (packTotal === 0) {
      packDetail = "Pack empresa sin tipos configurados";
    } else if (!packComplete) {
      packDetail = `${packOk} de ${packTotal} vigentes`;
    } else {
      packStatus = "ok";
      packDetail = `${packOk} de ${packTotal} vigentes`;
    }
    items.unshift({
      requirementId: "00000000-0000-4000-8000-0000000000c1",
      key: "company_pack_baseline",
      kind: "document",
      scope: "company",
      moment: "before",
      mandatory: true,
      label: packLabel,
      status: packStatus,
      detail: packDetail,
    });
  }

  const summary = {
    ok: items.filter((i) => i.status === "ok").length,
    later: items.filter((i) => i.status === "later").length,
    missing: items.filter((i) => i.status === "missing").length,
    notApplicable: items.filter((i) => i.status === "not_applicable").length,
  };

  /**
   * Solo bloquea create el pack HAB (o ítem sintético), no exigencias
   * puntuales del tipo de trabajo (esas van «Después» / al completar).
   */
  const blockingMissing = items.some(
    (i) =>
      i.status === "missing" &&
      i.mandatory &&
      i.scope === "company" &&
      i.moment === "before" &&
      (i.key === "company_pack_baseline" ||
        i.key.includes("docs_company") ||
        i.label.toLowerCase().includes("pack")),
  );
  const habOk = Boolean(hab && hab.status === "approved");
  /** Crear PT: HAB aprobada + pack empresa al día. */
  const canCreate = habOk && packComplete && !blockingMissing;

  return {
    organizationId: org.id,
    organization: { id: org.id, name: org.name, rut: org.rut },
    permitTypeId: permitType.id,
    permitType: {
      id: permitType.id,
      code: permitType.code,
      name: permitType.name,
    },
    accreditation: hab,
    summary,
    items,
    canCreate,
  };
}

/**
 * POST /work-permits — Prevención crea el PT desde un aviso pending.
 * R-09 HAB approved; R-11/R-13: check + snapshot. Status inicial: to_complete.
 */
export async function createWorkPermitFromNotice(
  actor: Actor,
  body: CreateWorkPermitBody,
): Promise<WorkPermitResponse> {
  const notice = await prisma.workNotice.findFirst({
    where: { id: body.workNoticeId, deletedAt: null },
    include: {
      workPermit: { select: { id: true, code: true } },
      organization: { select: { id: true, deletedAt: true, active: true } },
    },
  });
  if (!notice || notice.organization.deletedAt) {
    throw new AppError(400, "work_notice_not_found", "Aviso no encontrado");
  }
  // Crear PT es acción de Prevención (staff), no del portal contratista.
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "El permiso lo crea Prevención desde el aviso",
    );
  }
  assertPermitAccess(actor, {
    businessId: notice.businessId,
    organizationId: notice.organizationId,
    locationId: notice.locationId,
  });
  await assertBusinessModuleEnabled(notice.businessId, "work_permits");

  if (notice.status === "cancelled") {
    throw new AppError(
      400,
      "work_notice_cancelled",
      "El aviso está anulado; no se puede crear permiso",
    );
  }
  if (notice.workPermit) {
    throw new AppError(
      409,
      "work_permit_already_exists",
      `Este aviso ya tiene permiso ${notice.workPermit.code}`,
    );
  }
  if (!notice.organization.active) {
    throw new AppError(
      400,
      "contractor_inactive",
      "La organización está inactiva",
    );
  }

  const check = await checkWorkPermitRequirements(actor, {
    organizationId: notice.organizationId,
    permitTypeId: notice.permitTypeId,
  });
  if (!check.canCreate) {
    const packItem = check.items.find(
      (i) => i.key === "company_pack_baseline" || i.key.includes("docs_company"),
    );
    const packIncomplete =
      check.accreditation?.status === "approved" &&
      packItem?.status === "missing";
    throw new AppError(
      422,
      "work_permit_requirements_unmet",
      check.accreditation?.status !== "approved"
        ? "La empresa debe tener habilitación aprobada para crear el permiso"
        : packIncomplete
          ? "No se puede crear: el pack empresa de la habilitación está incompleto o vencido"
          : "Faltan exigencias de empresa obligatorias; revisá la verificación",
      {
        summary: check.summary,
        missing: check.items.filter((i) => i.status === "missing"),
      },
    );
  }

  const snapshot: Prisma.InputJsonValue = {
    checkedAt: new Date().toISOString(),
    accreditation: check.accreditation,
    summary: check.summary,
    items: check.items,
  };

  const { flowId, snapshot: flowSnapshot } = await resolveApprovalFlowSnapshot(
    notice.businessId,
    notice.permitTypeId,
  );

  const created = await prisma.$transaction(async (tx) => {
    const code = await nextWorkPermitCode(tx);
    const permit = await tx.workPermit.create({
      data: {
        businessId: notice.businessId,
        code,
        workNoticeId: notice.id,
        organizationId: notice.organizationId,
        permitTypeId: notice.permitTypeId,
        locationId: notice.locationId,
        scheduledDate: notice.tentativeDate,
        description:
          body.description === undefined
            ? notice.description
            : body.description?.trim() || null,
        status: "to_complete",
        requirementsSnapshot: snapshot,
        approvalFlowId: flowId,
        approvalFlowSnapshot: flowSnapshot
          ? (flowSnapshot as unknown as Prisma.InputJsonValue)
          : undefined,
        createdById: actor.id,
      },
      include: permitInclude,
    });
    await tx.workNotice.update({
      where: { id: notice.id },
      data: { status: "linked" },
    });
    return permit;
  });

  // Avisa al portal contratista (usuarios de la org + contactEmail).
  try {
    await enqueueWorkPermitCreatedNotifications({
      id: created.id,
      code: created.code,
      businessId: created.businessId,
      organizationId: created.organizationId,
      organizationName: created.organization.name,
      locationName: created.location.name,
      permitTypeName: `${created.permitType.code} — ${created.permitType.name}`,
      scheduledDate: created.scheduledDate,
      workNoticeCode: created.workNotice?.code ?? null,
      description: created.description,
      contactEmail: created.organization.contactEmail,
    });
  } catch (error) {
    console.error("No se pudo encolar mail de PT al contratista", {
      workPermitId: created.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return toWorkPermitResponse(created);
}

/**
 * Exige ≥1 persona con pack persona completo + checklist contractor.
 * Sin documentación vigente no se puede enviar a aprobación.
 */
async function assertReadyToSubmit(
  workPermitId: string,
  permitTypeId: string,
  organizationId: string,
  businessId: string,
) {
  const assigned = await prisma.workPermitPerson.findMany({
    where: { workPermitId },
    select: {
      personId: true,
      person: { select: { fullName: true, deletedAt: true, active: true } },
    },
  });
  const activePeople = assigned.filter(
    (r) => r.person.active && !r.person.deletedAt,
  );
  if (activePeople.length < 1) {
    throw new AppError(
      422,
      "work_permit_incomplete",
      "Asigná al menos una persona antes de enviar a aprobación",
      { missing: "people" },
    );
  }

  const peoplePayload = activePeople.map((p) => ({
    id: p.personId,
    fullName: p.person.fullName,
  }));
  await assertPeoplePersonPackComplete(
    businessId,
    organizationId,
    peoplePayload,
  );
  await assertPeoplePermitPersonRequirements(
    businessId,
    organizationId,
    permitTypeId,
    peoplePayload,
  );

  const activeItems = await prisma.permitChecklistItem.findMany({
    where: { permitTypeId, active: true },
    select: { id: true },
  });
  if (activeItems.length === 0) return;

  const answers = await prisma.workPermitChecklistAnswer.findMany({
    where: {
      workPermitId,
      stage: "contractor",
      checklistItemId: { in: activeItems.map((i) => i.id) },
    },
    select: { checklistItemId: true },
  });
  if (answers.length < activeItems.length) {
    throw new AppError(
      422,
      "work_permit_incomplete",
      "Completá todos los ítems del checklist antes de enviar",
      {
        missing: "checklist",
        answered: answers.length,
        required: activeItems.length,
      },
    );
  }
}

/**
 * Exigencia de persona del tipo con evidencia documental (doc o capacitación
 * enlazada a DocumentType). Pack HAB se valida aparte.
 */
type PersonDocRequirement = {
  key: string;
  label: string;
  /** null = exigencia sin tipo de evidencia configurado (siempre falta). */
  documentTypeId: string | null;
  documentType: { code: string; name: string } | null;
};

/**
 * Carga exigencias person/before: documentos con documentTypeId + capacitaciones
 * con evidencia (Training.documentTypeId o DocumentType del mismo código).
 */
async function loadPersonDocRequirements(
  permitTypeId: string,
): Promise<PersonDocRequirement[]> {
  const permitType = await prisma.permitType.findFirst({
    where: { id: permitTypeId, deletedAt: null },
    select: { businessId: true },
  });
  if (!permitType) return [];

  const rows = await prisma.permitTypeRequirement.findMany({
    where: {
      permitTypeId,
      active: true,
      mandatory: true,
      scope: "person",
      moment: "before",
      OR: [{ kind: "document", documentTypeId: { not: null } }, { kind: "training" }],
    },
    include: {
      documentType: { select: { id: true, code: true, name: true } },
      training: {
        select: {
          id: true,
          code: true,
          documentTypeId: true,
          documentType: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  const trainingCodesNeedingFallback = [
    ...new Set(
      rows
        .filter(
          (r) =>
            r.kind === "training" &&
            !r.training?.documentTypeId &&
            (r.trainingCode || r.training?.code),
        )
        .map((r) => (r.trainingCode ?? r.training!.code).trim()),
    ),
  ];
  const fallbackByCode = new Map<
    string,
    { id: string; code: string; name: string }
  >();
  if (trainingCodesNeedingFallback.length > 0) {
    const found = await prisma.documentType.findMany({
      where: {
        businessId: permitType.businessId,
        deletedAt: null,
        state: true,
        code: { in: trainingCodesNeedingFallback },
      },
      select: { id: true, code: true, name: true },
    });
    for (const d of found) fallbackByCode.set(d.code, d);
  }

  const out: PersonDocRequirement[] = [];
  for (const r of rows) {
    if (r.kind === "document" && r.documentTypeId) {
      // Pack «los 8» vive en accreditationScope; aquí solo docs puntuales.
      if (r.accreditationScope === "person") continue;
      out.push({
        key: r.key,
        label: r.label,
        documentTypeId: r.documentTypeId,
        documentType: r.documentType
          ? { code: r.documentType.code, name: r.documentType.name }
          : null,
      });
      continue;
    }
    if (r.kind === "training") {
      const linked = r.training?.documentType ?? null;
      const code = (r.trainingCode ?? r.training?.code ?? "").trim();
      const fallback = code ? fallbackByCode.get(code) : undefined;
      const evidence = linked
        ? { id: linked.id, code: linked.code, name: linked.name }
        : fallback
          ? { id: fallback.id, code: fallback.code, name: fallback.name }
          : null;
      out.push({
        key: r.key,
        label: r.label,
        documentTypeId: evidence?.id ?? null,
        documentType: evidence
          ? { code: evidence.code, name: evidence.name }
          : code
            ? { code, name: r.label }
            : null,
      });
    }
  }
  return out;
}

/** Qué docs de exigencia por persona faltan (validados vigentes) en la HAB. */
async function getPersonRequirementGaps(
  habId: string,
  personId: string,
  requirements: PersonDocRequirement[],
): Promise<{
  missingCodes: string[];
  missingLabels: string[];
  pendingLabels: string[];
  absentLabels: string[];
}> {
  if (requirements.length === 0) {
    return {
      missingCodes: [],
      missingLabels: [],
      pendingLabels: [],
      absentLabels: [],
    };
  }

  const typeIds = requirements
    .map((r) => r.documentTypeId)
    .filter((id): id is string => Boolean(id));

  const now = Date.now();
  const docs =
    typeIds.length === 0
      ? []
      : await prisma.contractorPersonDocument.findMany({
          where: {
            accreditationId: habId,
            personId,
            deletedAt: null,
            status: { not: "replaced" },
            documentTypeId: { in: typeIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            documentTypeId: true,
            status: true,
            expiresAt: true,
          },
        });
  const byType = new Map<string, { status: string; expiresAt: Date | null }>();
  for (const doc of docs) {
    if (!byType.has(doc.documentTypeId)) {
      byType.set(doc.documentTypeId, {
        status: doc.status,
        expiresAt: doc.expiresAt,
      });
    }
  }

  const missingCodes: string[] = [];
  const missingLabels: string[] = [];
  const pendingLabels: string[] = [];
  const absentLabels: string[] = [];
  for (const req of requirements) {
    if (!req.documentTypeId) {
      missingCodes.push(req.documentType?.code ?? req.key);
      missingLabels.push(req.label);
      absentLabels.push(req.label);
      continue;
    }
    const row = byType.get(req.documentTypeId);
    const ok =
      Boolean(row) &&
      row!.status === "validated" &&
      !(row!.expiresAt && row!.expiresAt.getTime() < now);
    if (!ok) {
      missingCodes.push(req.documentType?.code ?? req.key);
      missingLabels.push(req.label);
      if (!row) {
        absentLabels.push(req.label);
      } else if (
        row.status === "validated" &&
        row.expiresAt &&
        row.expiresAt.getTime() < now
      ) {
        absentLabels.push(req.label);
      } else {
        pendingLabels.push(req.label);
      }
    }
  }
  return { missingCodes, missingLabels, pendingLabels, absentLabels };
}

/**
 * Exigencias document/person del tipo de permiso (ej. libreta/EC de BUC):
 * cada persona debe tener el doc validado y vigente en la HAB actual.
 */
async function assertPeoplePermitPersonRequirements(
  businessId: string,
  organizationId: string,
  permitTypeId: string,
  people: Array<{ id: string; fullName: string }>,
): Promise<void> {
  if (people.length === 0) return;

  const requirements = await loadPersonDocRequirements(permitTypeId);
  if (requirements.length === 0) return;

  const hab = await prisma.contractorAccreditation.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true },
  });
  if (!hab) {
    throw new AppError(
      422,
      "person_permit_requirements_incomplete",
      "La organización no tiene habilitación; no se pueden verificar documentos de persona",
    );
  }

  const incomplete: Array<{
    personId: string;
    fullName: string;
    missingCodes: string[];
    missingLabels: string[];
  }> = [];

  for (const person of people) {
    const gaps = await getPersonRequirementGaps(
      hab.id,
      person.id,
      requirements,
    );
    if (gaps.missingLabels.length > 0) {
      incomplete.push({
        personId: person.id,
        fullName: person.fullName,
        missingCodes: gaps.missingCodes,
        missingLabels: gaps.missingLabels,
      });
    }
  }

  if (incomplete.length > 0) {
    const detail = incomplete
      .map(
        (p) =>
          `${p.fullName} (faltan: ${p.missingLabels.join(", ") || p.missingCodes.join(", ")})`,
      )
      .join("; ");
    throw new AppError(
      422,
      "person_permit_requirements_incomplete",
      `Documentos de persona exigidos por el tipo de permiso incompletos: ${detail}`,
      { incomplete, accreditationCode: hab.code },
    );
  }
}

/**
 * Todas las personas deben tener el pack persona validado y vigente en la HAB.
 */
async function assertPeoplePersonPackComplete(
  businessId: string,
  organizationId: string,
  people: Array<{ id: string; fullName: string }>,
): Promise<void> {
  if (people.length === 0) return;

  const hab = await prisma.contractorAccreditation.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, status: true },
  });
  if (!hab) {
    throw new AppError(
      422,
      "person_pack_incomplete",
      "La organización no tiene habilitación; no se puede asignar personal sin pack persona",
    );
  }

  const packTypesCount = await prisma.documentType.count({
    where: {
      businessId,
      deletedAt: null,
      state: true,
      accreditationPack: "person",
    },
  });
  if (packTypesCount === 0) {
    throw new AppError(
      422,
      "person_pack_empty",
      "No hay tipos en el pack persona; configurá Packs de habilitación",
    );
  }

  const incomplete: Array<{
    personId: string;
    fullName: string;
    ok: number;
    total: number;
    missingCodes: string[];
  }> = [];
  for (const person of people) {
    const pack = await evaluatePersonPack(businessId, hab.id, person.id);
    if (!pack.complete) {
      incomplete.push({
        personId: person.id,
        fullName: person.fullName,
        ok: pack.ok,
        total: pack.total,
        missingCodes: pack.missingCodes,
      });
    }
  }

  if (incomplete.length > 0) {
    const names = incomplete.map((p) => p.fullName).join(", ");
    throw new AppError(
      422,
      "person_pack_incomplete",
      `No se puede operar con personal sin documentación completa: ${names}`,
      { incomplete, accreditationCode: hab.code },
    );
  }
}

/**
 * POST /work-permits/:id/submit — contratista o Prevención envía a aprobación.
 * to_complete → to_approve (E13). Exige personal + checklist contractor.
 */
export async function submitWorkPermit(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_complete") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede enviar a aprobación desde estado ${existing.status}`,
    );
  }

  await assertReadyToSubmit(
    existing.id,
    existing.permitTypeId,
    existing.organizationId,
    existing.businessId,
  );

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "to_approve" },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/approve — Prevención aprueba.
 * to_approve → to_receive (si el flujo tiene recepción) o active (si no).
 */
export async function approveWorkPermit(
  actor: Actor,
  id: string,
  body: WorkPermitDigitalSignatureBody,
): Promise<WorkPermitResponse> {
  assertStaffNotContractor(actor);

  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_approve") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede aprobar desde estado ${existing.status}`,
    );
  }

  const policy = flowPolicyFromRow(existing);
  /** Sin etapa receive en el flujo → pasa directo a autorizado. */
  const nextStatus = policy.hasReceiveStage ? "to_receive" : "active";

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: nextStatus, reviewNote: null },
    include: permitInclude,
  });
  await upsertWorkPermitSignature(id, "prevention_approve", actor.id, {
    digital: body,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/return — Prevención devuelve con motivo.
 * to_approve → to_complete.
 */
export async function returnWorkPermit(
  actor: Actor,
  id: string,
  body: WorkPermitReviewNoteBody,
): Promise<WorkPermitResponse> {
  assertStaffNotContractor(actor);

  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_approve") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede devolver desde estado ${existing.status}`,
    );
  }

  const updated = await prisma.workPermit.update({
    where: { id },
    data: {
      status: "to_complete",
      reviewNote: body.reviewNote.trim(),
    },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/receive — capitán recibe a bordo.
 * Si el flujo no tiene recepción: Prevención puede destrabar to_receive → active
 * (PTs aprobados antes del motor dinámico).
 */
export async function receiveWorkPermit(
  actor: Actor,
  id: string,
  body: WorkPermitDigitalSignatureBody,
): Promise<WorkPermitResponse> {
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "Solo el personal de la empresa puede recibir el permiso",
    );
  }

  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_receive") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede recibir desde estado ${existing.status}`,
    );
  }

  const policy = flowPolicyFromRow(existing);

  if (!policy.hasReceiveStage) {
    const canSkip = await actorHasPermission(
      actor,
      PERMISSION_RESOURCE.WORK_PERMITS,
      PERMISSION_ACTION.UPDATE,
    );
    if (!canSkip) {
      throw new AppError(
        403,
        "forbidden",
        "Este flujo no tiene recepción a bordo; Prevención debe continuar",
      );
    }
    await assertPriorSignatures(id, [
      {
        kind: "prevention_approve",
        label: "Aprobación Prevención",
        digital: true,
      },
    ]);
    const updated = await prisma.workPermit.update({
      where: { id },
      data: { status: "active", reviewNote: null },
      include: permitInclude,
    });
    return toWorkPermitResponse(updated);
  }

  const canReceive = await actorHasPermission(
    actor,
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.RECEIVE,
  );
  if (!canReceive) {
    throw new AppError(
      403,
      "forbidden",
      "Solo el capitán puede recibir el permiso a bordo",
    );
  }

  await assertPriorSignatures(id, [
    {
      kind: "prevention_approve",
      label: "Aprobación Prevención",
      digital: true,
    },
  ]);

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "active", reviewNote: null },
    include: permitInclude,
  });
  await upsertWorkPermitSignature(id, "captain_receive", actor.id, {
    digital: body,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/reject-receipt — capitán no autoriza.
 * to_receive → to_approve (vuelve a Prevención) con motivo.
 */
export async function rejectReceiptWorkPermit(
  actor: Actor,
  id: string,
  body: WorkPermitReviewNoteBody,
): Promise<WorkPermitResponse> {
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "Solo el capitán puede rechazar la recepción",
    );
  }

  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  if (existing.status !== "to_receive") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede rechazar recepción desde estado ${existing.status}`,
    );
  }

  const updated = await prisma.workPermit.update({
    where: { id },
    data: {
      status: "to_approve",
      reviewNote: body.reviewNote.trim(),
    },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/request-close — contratista o Prevención.
 * active → to_verify (Verificar trabajo).
 * observation opcional: queda en reviewNote + nota de la firma de cierre.
 */
export async function requestCloseWorkPermit(
  actor: Actor,
  id: string,
  body: { observation?: string | null },
): Promise<WorkPermitResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const policy = flowPolicyFromRow(existing);

  if (existing.status !== "active") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `Solo se pide cierre desde trabajo autorizado / a bordo (ahora: ${existing.status})`,
    );
  }

  if (!policy.hasRequestCloseStage && policy.closeActor === "prevention") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      "Este flujo no pide cierre intermedio: Prevención cierra directo el trabajo",
    );
  }

  await assertPriorSignatures(id, signaturesBeforeRequestClose(policy));

  /** Comentario al pedir cierre (vacío → null). */
  const observation = body.observation?.trim() || null;

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "to_verify", reviewNote: observation },
    include: permitInclude,
  });
  await upsertWorkPermitSignature(id, "contractor_request_close", actor.id, {
    note: observation,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/close — cierre final según flujo (capitán o Prevención).
 * Con pedido de cierre: to_verify → closed.
 * Sin pedido y cierre Prevención: active → closed.
 */
export async function closeWorkPermit(
  actor: Actor,
  id: string,
  body: WorkPermitDigitalSignatureBody,
): Promise<WorkPermitResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const policy = flowPolicyFromRow(existing);
  await assertCloseActorAllowed(actor, policy);

  const allowedStatuses: string[] = policy.hasRequestCloseStage
    ? ["to_verify"]
    : policy.closeActor === "prevention"
      ? ["active", "to_verify"]
      : ["to_verify"];

  if (!allowedStatuses.includes(existing.status)) {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      policy.hasRequestCloseStage
        ? `Solo se cierra desde «Verificar trabajo» (ahora: ${existing.status})`
        : policy.hasReceiveStage
          ? `Prevención cierra desde «Autorizado a bordo» (ahora: ${existing.status})`
          : `Prevención cierra desde «Trabajo autorizado» (ahora: ${existing.status})`,
    );
  }

  await assertPriorSignatures(id, signaturesBeforeFinalClose(policy));

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "closed", reviewNote: null },
    include: permitInclude,
  });
  await upsertWorkPermitSignature(id, "captain_close", actor.id, {
    digital: body,
  });
  return toWorkPermitResponse(updated);
}

/** Body sin cierre = nota + firma digital. */
type RejectCloseBody = WorkPermitReviewNoteBody & WorkPermitDigitalSignatureBody;

/**
 * POST /work-permits/:id/reject-close — deja el PT sin cierre (actor del flujo).
 * to_verify → no_closure con motivo + firma digital.
 */
export async function rejectCloseWorkPermit(
  actor: Actor,
  id: string,
  body: RejectCloseBody,
): Promise<WorkPermitResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const policy = flowPolicyFromRow(existing);
  await assertCloseActorAllowed(actor, policy);

  if (existing.status !== "to_verify") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `Solo se marca sin cierre desde «Verificar trabajo» (ahora: ${existing.status})`,
    );
  }

  await assertPriorSignatures(id, signaturesBeforeFinalClose(policy));

  const updated = await prisma.workPermit.update({
    where: { id },
    data: {
      status: "no_closure",
      reviewNote: body.reviewNote.trim(),
    },
    include: permitInclude,
  });
  await upsertWorkPermitSignature(id, "captain_no_closure", actor.id, {
    note: body.reviewNote,
    digital: {
      signerName: body.signerName,
      accepted: body.accepted,
      signatureImage: body.signatureImage,
    },
  });
  return toWorkPermitResponse(updated);
}

/**
 * GET /work-permits/:id/document — ficha imprimible del PT + firmas (P6c).
 * Sin PDF binario: la web imprime esta vista.
 */
export async function getWorkPermitDocument(
  actor: Actor,
  id: string,
): Promise<WorkPermitDocumentResponse> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const [issuer, people, checklist, signatures] = await Promise.all([
    prisma.business.findFirst({
      where: { id: existing.businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        rut: true,
        giro: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
      },
    }),
    prisma.workPermitPerson.findMany({
      where: { workPermitId: id },
      include: {
        person: {
          select: {
            fullName: true,
            rut: true,
            position: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workPermitChecklistAnswer.findMany({
      where: { workPermitId: id, stage: "contractor" },
      include: {
        checklistItem: { select: { order: true, text: true, active: true } },
      },
      orderBy: { answeredAt: "asc" },
    }),
    prisma.workPermitSignature.findMany({
      where: { workPermitId: id },
      orderBy: { signedAt: "asc" },
    }),
  ]);

  if (!issuer) {
    throw new AppError(
      404,
      "business_not_found",
      "Empresa mandante del permiso no encontrada",
    );
  }

  const kindLabel: Record<WorkPermitSignatureKind, string> = {
    prevention_approve: "Aprobación Prevención",
    captain_receive: "Autorización a bordo",
    contractor_request_close: "Solicitud de cierre",
    captain_close: "Cierre del trabajo",
    captain_no_closure: "Sin cierre",
  };

  return {
    issuer: {
      id: issuer.id,
      name: issuer.name,
      rut: issuer.rut,
      giro: issuer.giro,
      commune: issuer.commune,
      city: issuer.city,
      phone: issuer.phone,
      email: issuer.email,
    },
    permit: toWorkPermitResponse(existing),
    people: people
      .filter((r) => !r.person.deletedAt)
      .map((r) => ({
        fullName: r.person.fullName,
        rut: r.person.rut,
        position: r.person.position,
      })),
    checklist: checklist
      .filter((a) => a.checklistItem.active)
      .sort((a, b) => a.checklistItem.order - b.checklistItem.order)
      .map((a) => ({
        order: a.checklistItem.order,
        text: a.checklistItem.text,
        answer: a.answer,
      })),
    signatures: signatures.map((s) => ({
      kind: s.kind,
      label: kindLabel[s.kind],
      signerName: s.signerName,
      signedAt: s.signedAt.toISOString(),
      note: s.note,
      signatureImage: s.signatureImage,
      acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null,
    })),
  };
}

/** Persona serializada en el PT (con readiness de docs). */
type WorkPermitPersonDto = {
  personId: string;
  fullName: string;
  rut: string;
  position: string | null;
  presentAt: string | null;
  accreditationId: string | null;
  packComplete: boolean;
  pendingPackCodes: string[];
  absentPackCodes: string[];
  missingRequirementLabels: string[];
  pendingRequirementLabels: string[];
  absentRequirementLabels: string[];
  docsOk: boolean;
};

/** Carga el PT editable (solo to_complete) o lanza. */
async function loadEditablePermit(actor: Actor, id: string) {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");
  if (existing.status !== "to_complete") {
    throw new AppError(
      409,
      "work_permit_not_editable",
      "Solo se puede completar un permiso en «Por completar»",
    );
  }
  return existing;
}

/**
 * Lista personal asignado (lectura en cualquier estado con acceso).
 * Incluye readiness pack/faena + accreditationId para revisar docs en la ficha.
 */
export async function listWorkPermitPeople(
  actor: Actor,
  id: string,
): Promise<{
  items: WorkPermitPersonDto[];
  personRequirementLabels: string[];
}> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const [rows, requirements, hab] = await Promise.all([
    prisma.workPermitPerson.findMany({
      where: { workPermitId: id },
      include: {
        person: {
          select: {
            id: true,
            fullName: true,
            rut: true,
            position: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    loadPersonDocRequirements(existing.permitTypeId),
    prisma.contractorAccreditation.findFirst({
      where: { organizationId: existing.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  const personRequirementLabels = requirements.map((r) => r.label);
  const items: WorkPermitPersonDto[] = [];

  for (const r of rows) {
    if (r.person.deletedAt) continue;

    let packComplete = false;
    let pendingPackCodes: string[] = [];
    let absentPackCodes: string[] = [];
    if (hab) {
      const pack = await evaluatePersonPack(
        existing.businessId,
        hab.id,
        r.personId,
      );
      packComplete = pack.complete;
      pendingPackCodes = pack.pendingCodes;
      absentPackCodes = pack.absentCodes;
    } else {
      absentPackCodes = ["habilitacion"];
    }

    const gaps = hab
      ? await getPersonRequirementGaps(hab.id, r.personId, requirements)
      : {
          missingLabels: requirements.map((req) => req.label),
          pendingLabels: [] as string[],
          absentLabels: requirements.map((req) => req.label),
        };

    items.push({
      personId: r.personId,
      fullName: r.person.fullName,
      rut: r.person.rut,
      position: r.person.position,
      presentAt: r.presentAt ? r.presentAt.toISOString() : null,
      accreditationId: hab?.id ?? null,
      packComplete,
      pendingPackCodes,
      absentPackCodes,
      missingRequirementLabels: gaps.missingLabels,
      pendingRequirementLabels: gaps.pendingLabels,
      absentRequirementLabels: gaps.absentLabels,
      docsOk: packComplete && gaps.missingLabels.length === 0 && Boolean(hab),
    });
  }

  return { items, personRequirementLabels };
}

/** Persona activa de la org con readiness pack + exigencias del tipo. */
export type WorkPermitAssignablePersonDto = {
  personId: string;
  fullName: string;
  rut: string;
  position: string | null;
  packComplete: boolean;
  missingPackCodes: string[];
  pendingPackCodes: string[];
  absentPackCodes: string[];
  missingRequirementLabels: string[];
  missingRequirementCodes: string[];
  pendingRequirementLabels: string[];
  absentRequirementLabels: string[];
  accreditationId: string | null;
  canAssign: boolean;
};

/**
 * GET /work-permits/:id/assignable-people —
 * listado de personal activo con qué falta para poder asignarlos al PT.
 */
export async function listWorkPermitAssignablePeople(
  actor: Actor,
  id: string,
): Promise<{
  items: WorkPermitAssignablePersonDto[];
  personRequirementLabels: string[];
}> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const [people, requirements, hab, packTypesCount] = await Promise.all([
    prisma.contractorPerson.findMany({
      where: {
        organizationId: existing.organizationId,
        deletedAt: null,
        active: true,
      },
      select: {
        id: true,
        fullName: true,
        rut: true,
        position: true,
      },
      orderBy: { fullName: "asc" },
    }),
    loadPersonDocRequirements(existing.permitTypeId),
    prisma.contractorAccreditation.findFirst({
      where: { organizationId: existing.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.documentType.count({
      where: {
        businessId: existing.businessId,
        deletedAt: null,
        state: true,
        accreditationPack: "person",
      },
    }),
  ]);

  const personRequirementLabels = requirements.map((r) => r.label);
  const items: WorkPermitAssignablePersonDto[] = [];

  for (const person of people) {
    let packComplete = false;
    let missingPackCodes: string[] = [];
    let pendingPackCodes: string[] = [];
    let absentPackCodes: string[] = [];
    if (!hab || packTypesCount === 0) {
      packComplete = false;
      missingPackCodes =
        packTypesCount === 0 ? ["pack_persona"] : ["habilitacion"];
      absentPackCodes = missingPackCodes;
    } else {
      const pack = await evaluatePersonPack(
        existing.businessId,
        hab.id,
        person.id,
      );
      packComplete = pack.complete;
      missingPackCodes = pack.missingCodes;
      pendingPackCodes = pack.pendingCodes;
      absentPackCodes = pack.absentCodes;
    }

    const gaps = hab
      ? await getPersonRequirementGaps(hab.id, person.id, requirements)
      : {
          missingCodes: requirements.map((r) => r.documentType?.code ?? r.key),
          missingLabels: requirements.map((r) => r.label),
          pendingLabels: [] as string[],
          absentLabels: requirements.map((r) => r.label),
        };

    items.push({
      personId: person.id,
      fullName: person.fullName,
      rut: person.rut,
      position: person.position,
      packComplete,
      missingPackCodes,
      pendingPackCodes,
      absentPackCodes,
      missingRequirementLabels: gaps.missingLabels,
      missingRequirementCodes: gaps.missingCodes,
      pendingRequirementLabels: gaps.pendingLabels,
      absentRequirementLabels: gaps.absentLabels,
      accreditationId: hab?.id ?? null,
      // Asignar exige solo pack; las exigencias de faena se piden al enviar a aprobación.
      canAssign: packComplete && packTypesCount > 0 && Boolean(hab),
    });
  }

  return { items, personRequirementLabels };
}

/**
 * PUT /work-permits/:id/people — reemplaza el set (contratista o Prevención).
 * Exige pack persona completo. Las exigencias de faena del tipo se validan al submit.
 */
export async function putWorkPermitPeople(
  actor: Actor,
  id: string,
  body: PutWorkPermitPeopleBody,
): Promise<{ items: WorkPermitPersonDto[] }> {
  const existing = await loadEditablePermit(actor, id);
  const uniqueIds = [...new Set(body.personIds)];

  if (uniqueIds.length > 0) {
    const people = await prisma.contractorPerson.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId: existing.organizationId,
        deletedAt: null,
        active: true,
      },
      select: { id: true, fullName: true },
    });
    if (people.length !== uniqueIds.length) {
      throw new AppError(
        422,
        "invalid_work_permit_people",
        "Una o más personas no pertenecen a la organización o no están activas",
      );
    }
    await assertPeoplePersonPackComplete(
      existing.businessId,
      existing.organizationId,
      people,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.workPermitPerson.deleteMany({ where: { workPermitId: id } });
    if (uniqueIds.length > 0) {
      await tx.workPermitPerson.createMany({
        data: uniqueIds.map((personId) => ({
          workPermitId: id,
          personId,
        })),
      });
    }
  });

  return listWorkPermitPeople(actor, id);
}

/** Ítem de checklist con respuesta. */
type ChecklistItemDto = {
  checklistItemId: string;
  order: number;
  text: string;
  answer: "yes" | "no" | "na" | null;
  answeredAt: string | null;
};

/** GET checklist de una etapa (ítems activos del tipo + respuestas). */
export async function getWorkPermitChecklist(
  actor: Actor,
  id: string,
  stage: WorkPermitChecklistStage,
): Promise<{ stage: WorkPermitChecklistStage; items: ChecklistItemDto[] }> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const items = await prisma.permitChecklistItem.findMany({
    where: { permitTypeId: existing.permitTypeId, active: true },
    orderBy: { order: "asc" },
  });
  const answers = await prisma.workPermitChecklistAnswer.findMany({
    where: { workPermitId: id, stage },
  });
  const byItem = new Map(answers.map((a) => [a.checklistItemId, a]));

  return {
    stage,
    items: items.map((item) => {
      const ans = byItem.get(item.id);
      return {
        checklistItemId: item.id,
        order: item.order,
        text: item.text,
        answer: ans ? ans.answer : null,
        answeredAt: ans ? ans.answeredAt.toISOString() : null,
      };
    }),
  };
}

/**
 * PUT /work-permits/:id/checklist — upsert respuestas de una etapa.
 * En P5d solo se edita stage=contractor mientras to_complete.
 */
export async function putWorkPermitChecklist(
  actor: Actor,
  id: string,
  body: PutWorkPermitChecklistBody,
): Promise<{ stage: WorkPermitChecklistStage; items: ChecklistItemDto[] }> {
  const existing = await loadEditablePermit(actor, id);
  const stage = body.stage ?? "contractor";
  if (stage !== "contractor") {
    throw new AppError(
      422,
      "invalid_checklist_stage",
      "En este paso solo se completa el checklist del contratista",
    );
  }

  const activeItems = await prisma.permitChecklistItem.findMany({
    where: { permitTypeId: existing.permitTypeId, active: true },
  });
  const activeById = new Map(activeItems.map((i) => [i.id, i]));

  for (const row of body.answers) {
    if (!activeById.has(row.checklistItemId)) {
      throw new AppError(
        422,
        "invalid_checklist_item",
        "Hay un ítem que no pertenece al tipo de este permiso",
        { checklistItemId: row.checklistItemId },
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const row of body.answers) {
      const item = activeById.get(row.checklistItemId)!;
      await tx.workPermitChecklistAnswer.upsert({
        where: {
          workPermitId_stage_checklistItemId: {
            workPermitId: id,
            stage,
            checklistItemId: row.checklistItemId,
          },
        },
        create: {
          workPermitId: id,
          stage,
          checklistItemId: row.checklistItemId,
          itemText: item.text,
          answer: row.answer,
          answeredById: actor.id,
          answeredAt: now,
        },
        update: {
          itemText: item.text,
          answer: row.answer,
          answeredById: actor.id,
          answeredAt: now,
        },
      });
    }
  });

  return getWorkPermitChecklist(actor, id, stage);
}

/** Tone del chip de resultado en historial. */
type HistoryTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Mapea activity_log del PT a evento legible. */
function mapWorkPermitHistoryEvent(row: {
  action: string;
  targetLabel: string | null;
  success: boolean;
}): {
  event: string;
  detail: string | null;
  result: string;
  resultTone: HistoryTone;
} {
  const label = row.targetLabel ?? "";
  if (!row.success) {
    return {
      event: "Acción fallida",
      detail: label || null,
      result: "Error",
      resultTone: "danger",
    };
  }
  if (row.action === "CREATE") {
    return {
      event: "Permiso creado",
      detail: label || null,
      result: "Creado",
      resultTone: "info",
    };
  }
  if (label.includes("submit")) {
    return {
      event: "Enviado a revisión",
      detail: label || null,
      result: "Enviado",
      resultTone: "info",
    };
  }
  if (label.includes("approve")) {
    return {
      event: "Aprobado por Prevención",
      detail: label || null,
      result: "Aprobado",
      resultTone: "success",
    };
  }
  if (label.includes("return")) {
    return {
      event: "Devuelto al contratista",
      detail: label || null,
      result: "Devuelto",
      resultTone: "warning",
    };
  }
  if (label.includes("reject-receipt")) {
    return {
      event: "Recepción no autorizada",
      detail: label || null,
      result: "No autorizado",
      resultTone: "danger",
    };
  }
  if (label.includes("receive")) {
    return {
      event: "Autorizado a bordo",
      detail: label || null,
      result: "Recibido",
      resultTone: "success",
    };
  }
  if (label.includes("request-close")) {
    return {
      event: "Cierre solicitado",
      detail: label || null,
      result: "Por verificar",
      resultTone: "info",
    };
  }
  if (label.includes("reject-close")) {
    return {
      event: "Sin cierre",
      detail: label || null,
      result: "Sin cierre",
      resultTone: "danger",
    };
  }
  if (label.includes("close") && !label.includes("request")) {
    return {
      event: "Trabajo cerrado",
      detail: label || null,
      result: "Cerrado",
      resultTone: "success",
    };
  }
  if (label.includes("people")) {
    return {
      event: "Personal actualizado",
      detail: label || null,
      result: "Actualizado",
      resultTone: "neutral",
    };
  }
  if (label.includes("checklist")) {
    return {
      event: "Checklist actualizado",
      detail: label || null,
      result: "Actualizado",
      resultTone: "neutral",
    };
  }
  return {
    event: "Permiso actualizado",
    detail: label || null,
    result: "OK",
    resultTone: "neutral",
  };
}

/**
 * GET /work-permits/:id/history — activity_logs del permiso (como HAB).
 */
export async function listWorkPermitHistory(
  actor: Actor,
  id: string,
  query: ListWorkPermitHistoryQuery,
): Promise<{
  items: Array<{
    id: string;
    createdAt: string;
    event: string;
    role: string | null;
    user: string | null;
    detail: string | null;
    result: string;
    resultTone: HistoryTone;
    success: boolean;
    action: string;
    resource: string;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  // Valida acceso/tenant.
  await getWorkPermitById(actor, id);

  const where: Prisma.ActivityLogWhereInput = {
    resource: "workPermit",
    resourceId: id,
  };
  if (query.success === "true") where.success = true;
  if (query.success === "false") where.success = false;

  const search = query.search?.trim();
  if (search) {
    where.AND = [
      {
        OR: [
          { targetLabel: { contains: search, mode: "insensitive" } },
          { actorUsername: { contains: search, mode: "insensitive" } },
          { actorEmail: { contains: search, mode: "insensitive" } },
          { actorRole: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((row) => {
      const mapped = mapWorkPermitHistoryEvent(row);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        event: mapped.event,
        role: row.actorRole,
        user: row.actorUsername || row.actorEmail || null,
        detail: mapped.detail,
        result: mapped.result,
        resultTone: mapped.resultTone,
        success: row.success,
        action: row.action,
        resource: row.resource,
      };
    }),
    total,
    page,
    limit,
  };
}
