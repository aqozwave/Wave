import { Prisma } from "@prisma/client";
import { assertBusinessModuleEnabled } from "../../lib/businessModules.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../auth/auth.schemas.js";
import type {
  CreateWorkPermitBody,
  ListWorkPermitHistoryQuery,
  ListWorkPermitsQuery,
  PutWorkPermitChecklistBody,
  PutWorkPermitPeopleBody,
  WorkPermitChecklistStage,
  WorkPermitResponse,
  WorkPermitReviewNoteBody,
} from "./workPermits.schemas.js";

/** Actor con id, tenant, org y alcance de nave (capitán). */
type Actor = Pick<
  AuthUser,
  | "id"
  | "internalRol"
  | "businessId"
  | "organizationId"
  | "locationId"
  | "dataScope"
>;

/** Include para serializar PT. */
const permitInclude = {
  workNotice: { select: { id: true, code: true, status: true, deletedAt: true } },
  organization: {
    select: { id: true, name: true, rut: true, deletedAt: true },
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
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

/**
 * Acceso a un PT: superadmin OK; contratista solo su org;
 * alcance location → solo su nave; resto staff → su businessId.
 */
function assertPermitAccess(
  actor: Actor,
  row: { businessId: string; organizationId: string; locationId: string },
): void {
  if (actor.internalRol === "superadmin") return;
  if (actor.organizationId) {
    if (actor.organizationId !== row.organizationId) {
      throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
    }
    return;
  }
  if (!actor.businessId || actor.businessId !== row.businessId) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  // Capitán / colaborador: solo permisos de su nave.
  if (actor.dataScope === "location") {
    if (!actor.locationId || actor.locationId !== row.locationId) {
      throw new AppError(403, "forbidden", "Este permiso no es de tu nave");
    }
  }
}

/** Where listado (contratista acotado a su org). */
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

  // Portal contratista: solo su organización.
  if (actor.organizationId) {
    return { ...base, organizationId: actor.organizationId };
  }

  if (query.organizationId) base.organizationId = query.organizationId;

  if (actor.internalRol === "superadmin") {
    if (query.businessId) return { ...base, businessId: query.businessId };
    return base;
  }

  if (!actor.businessId) {
    throw new AppError(
      403,
      "forbidden",
      "Tu usuario no tiene una empresa asignada",
    );
  }

  // Capitán: solo PTs de su location.
  if (actor.dataScope === "location") {
    if (!actor.locationId) {
      throw new AppError(
        403,
        "forbidden",
        "Tu usuario no tiene una nave asignada",
      );
    }
    return {
      ...base,
      businessId: actor.businessId,
      locationId: actor.locationId,
    };
  }

  return { ...base, businessId: actor.businessId };
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
 * POST /work-permits — Prevención crea el PT desde un aviso pending.
 * Marca el aviso como linked. Status inicial: to_complete.
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

  return toWorkPermitResponse(created);
}

/**
 * Exige ≥1 persona y checklist contractor completo antes de enviar.
 * R-10 plena (solo habilitados) queda para P3; acá: persona activa de la org.
 */
async function assertReadyToSubmit(workPermitId: string, permitTypeId: string) {
  const peopleCount = await prisma.workPermitPerson.count({
    where: { workPermitId },
  });
  if (peopleCount < 1) {
    throw new AppError(
      422,
      "work_permit_incomplete",
      "Asigná al menos una persona antes de enviar a aprobación",
      { missing: "people" },
    );
  }

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

  await assertReadyToSubmit(existing.id, existing.permitTypeId);

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "to_approve" },
    include: permitInclude,
  });
  return toWorkPermitResponse(updated);
}

/**
 * POST /work-permits/:id/approve — Prevención aprueba.
 * to_approve → to_receive (sin firma en este paso; P6).
 */
export async function approveWorkPermit(
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

  if (existing.status !== "to_approve") {
    throw new AppError(
      409,
      "invalid_work_permit_transition",
      `No se puede aprobar desde estado ${existing.status}`,
    );
  }

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "to_receive", reviewNote: null },
    include: permitInclude,
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
 * to_receive → active (Autorizado a bordo). Sin checklist/firma en este paso.
 */
export async function receiveWorkPermit(
  actor: Actor,
  id: string,
): Promise<WorkPermitResponse> {
  if (actor.organizationId) {
    throw new AppError(
      403,
      "forbidden",
      "Solo el capitán puede recibir el permiso a bordo",
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

  const updated = await prisma.workPermit.update({
    where: { id },
    data: { status: "active", reviewNote: null },
    include: permitInclude,
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

/** Persona serializada en el PT. */
type WorkPermitPersonDto = {
  personId: string;
  fullName: string;
  rut: string;
  position: string | null;
  presentAt: string | null;
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

/** Lista personal asignado (lectura en cualquier estado con acceso). */
export async function listWorkPermitPeople(
  actor: Actor,
  id: string,
): Promise<{ items: WorkPermitPersonDto[] }> {
  const existing = await prisma.workPermit.findFirst({
    where: { id, deletedAt: null },
    include: permitInclude,
  });
  if (!existing || existing.organization.deletedAt) {
    throw new AppError(404, "work_permit_not_found", "Permiso no encontrado");
  }
  assertPermitAccess(actor, existing);
  await assertBusinessModuleEnabled(existing.businessId, "work_permits");

  const rows = await prisma.workPermitPerson.findMany({
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
  });

  return {
    items: rows
      .filter((r) => !r.person.deletedAt)
      .map((r) => ({
        personId: r.personId,
        fullName: r.person.fullName,
        rut: r.person.rut,
        position: r.person.position,
        presentAt: r.presentAt ? r.presentAt.toISOString() : null,
      })),
  };
}

/**
 * PUT /work-permits/:id/people — reemplaza el set (contratista o Prevención).
 * Personas deben ser activas de la misma org del PT.
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
      select: { id: true },
    });
    if (people.length !== uniqueIds.length) {
      throw new AppError(
        422,
        "invalid_work_permit_people",
        "Una o más personas no pertenecen a la organización o no están activas",
      );
    }
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
