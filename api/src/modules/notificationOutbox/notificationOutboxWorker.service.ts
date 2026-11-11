import type { NotificationOutbox, Prisma } from "@prisma/client";
import { getDateOnlyKey } from "../../lib/dateOnly.js";
import { prisma } from "../../lib/prisma.js";
import {
  sendAdminBoardingBookExpiryDigest,
  sendBoardingBookExpiringSoonEmail,
} from "../../emails/sendBoardingBookExpiryEmails.js";
import {
  sendAdminCourseExpiryDigest,
  sendCourseExpiredEmail,
  sendCourseExpiringSoonEmail,
} from "../../emails/sendCourseExpiryEmails.js";
import {
  sendAdminTrainingExpiryDigest,
  sendTrainingExpiredEmail,
  sendTrainingExpiringSoonEmail,
} from "../../emails/sendTrainingExpiryEmails.js";
import { sendWorkNoticeCreatedEmail } from "../../emails/sendWorkNoticeEmails.js";
import { sendWorkPermitCreatedEmail } from "../../emails/sendWorkPermitEmails.js";
import {
  claimNextPending,
  markCancelled,
  markFailed,
  markSent,
  recoverStaleProcessing,
  resolveNotificationRecipient,
} from "./notificationOutbox.service.js";

/** Tope por defecto de filas por corrida (no trabar el event loop). */
const DEFAULT_MAX_BATCH = 50;

/** Resultado de una corrida del worker. */
export type ProcessOutboxResult = {
  recovered: number;
  sent: number;
  failed: number;
  cancelled: number;
};

/** Lee payload tipado a lo mínimo (JSON libre en BD). */
function asPayload(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Valida digest admin: debe traer filas. */
function validateAdminDigestRow(row: NotificationOutbox): boolean {
  const payload = asPayload(row.payload);
  return Array.isArray(payload.rows) && payload.rows.length > 0;
}

/**
 * Curso por vencer/vencido: tripulante activo + assignment con misma fecha.
 * Si cambió expiresAt o se borró, se cancela (no reenviar basura).
 */
async function validateCourseRow(row: NotificationOutbox): Promise<boolean> {
  if (!row.crewMemberId) return false;
  const payload = asPayload(row.payload);
  const assignmentId =
    typeof payload.assignmentId === "string" ? payload.assignmentId : null;
  if (!assignmentId) return false;

  const crew = await prisma.crewMember.findFirst({
    where: {
      id: row.crewMemberId,
      deletedAt: null,
      state: true,
    },
    select: { id: true },
  });
  if (!crew) return false;

  const assignment = await prisma.crewMemberCourse.findFirst({
    where: {
      id: assignmentId,
      crewMemberId: row.crewMemberId,
      deletedAt: null,
    },
    select: { expiresAt: true },
  });
  if (!assignment) return false;

  const payloadKey =
    typeof payload.expiresAtKey === "number" ? payload.expiresAtKey : null;
  const currentKey = getDateOnlyKey(assignment.expiresAt);
  if (payloadKey == null || currentKey == null) return false;
  return payloadKey === currentKey;
}

/**
 * Libreta por vencer: tripulante activo + misma fecha de vigencia.
 * Si cambió boardingBookValidUntil o se borró, se cancela.
 */
async function validateBoardingBookExpiringRow(
  row: NotificationOutbox,
): Promise<boolean> {
  if (!row.crewMemberId) return false;
  const payload = asPayload(row.payload);
  const crew = await prisma.crewMember.findFirst({
    where: {
      id: row.crewMemberId,
      deletedAt: null,
      state: true,
    },
    select: { boardingBookValidUntil: true },
  });
  if (!crew) return false;

  const payloadKey =
    typeof payload.validUntilKey === "number" ? payload.validUntilKey : null;
  const currentKey = getDateOnlyKey(crew.boardingBookValidUntil);
  if (payloadKey == null || currentKey == null) return false;
  return payloadKey === currentKey;
}

/**
 * Capacitación por vencer/vencida: tripulante activo + assignment con misma fecha.
 */
async function validateTrainingRow(row: NotificationOutbox): Promise<boolean> {
  if (!row.crewMemberId) return false;
  const payload = asPayload(row.payload);
  const assignmentId =
    typeof payload.assignmentId === "string" ? payload.assignmentId : null;
  if (!assignmentId) return false;

  const crew = await prisma.crewMember.findFirst({
    where: {
      id: row.crewMemberId,
      deletedAt: null,
      state: true,
    },
    select: { id: true },
  });
  if (!crew) return false;

  const assignment = await prisma.crewMemberTraining.findFirst({
    where: {
      id: assignmentId,
      crewMemberId: row.crewMemberId,
      deletedAt: null,
    },
    select: { expiresAt: true },
  });
  if (!assignment) return false;

  const payloadKey =
    typeof payload.expiresAtKey === "number" ? payload.expiresAtKey : null;
  const currentKey = getDateOnlyKey(assignment.expiresAt);
  if (payloadKey == null || currentKey == null) return false;
  return payloadKey === currentKey;
}

/**
 * Aviso de trabajo: sigue existiendo (no soft-deleted).
 */
async function validateWorkNoticeCreatedRow(
  row: NotificationOutbox,
): Promise<boolean> {
  const payload = asPayload(row.payload);
  const workNoticeId =
    typeof payload.workNoticeId === "string" ? payload.workNoticeId : null;
  if (!workNoticeId) return false;
  const notice = await prisma.workNotice.findFirst({
    where: { id: workNoticeId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(notice);
}

/**
 * PT creado: sigue existiendo (no soft-deleted).
 */
async function validateWorkPermitCreatedRow(
  row: NotificationOutbox,
): Promise<boolean> {
  const payload = asPayload(row.payload);
  const workPermitId =
    typeof payload.workPermitId === "string" ? payload.workPermitId : null;
  if (!workPermitId) return false;
  const permit = await prisma.workPermit.findFirst({
    where: { id: workPermitId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(permit);
}

/** Decide si la fila sigue vigente antes de gastar un envío Resend. */
async function validateOutboxRow(row: NotificationOutbox): Promise<boolean> {
  switch (row.type) {
    case "course_expiring":
    case "course_expired":
      return validateCourseRow(row);
    case "training_expiring":
    case "training_expired":
      return validateTrainingRow(row);
    case "course_admin_digest":
    case "boarding_book_admin_digest":
    case "training_admin_digest":
      return validateAdminDigestRow(row);
    case "boarding_book_expiring":
      return validateBoardingBookExpiringRow(row);
    case "work_notice_created":
      return validateWorkNoticeCreatedRow(row);
    case "work_permit_created":
      return validateWorkPermitCreatedRow(row);
    default:
      return false;
  }
}

/** Despacha el mail según type; aplica override de prueba. */
async function dispatchOutboxEmail(
  row: NotificationOutbox,
): Promise<{ resendId: string | null; deliveredTo: string }> {
  const recipient = resolveNotificationRecipient(row.to);
  const payload = asPayload(row.payload);

  switch (row.type) {
    case "course_expiring": {
      const result = await sendCourseExpiringSoonEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        crewName: String(payload.crewName ?? ""),
        courseName: String(payload.courseName ?? ""),
        expiresAt:
          typeof payload.expiresAt === "string" ? payload.expiresAt : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "course_expired": {
      const result = await sendCourseExpiredEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        crewName: String(payload.crewName ?? ""),
        courseName: String(payload.courseName ?? ""),
        expiresAt:
          typeof payload.expiresAt === "string" ? payload.expiresAt : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "course_admin_digest": {
      const rows = Array.isArray(payload.rows)
        ? (payload.rows as Array<Record<string, unknown>>)
        : [];
      const result = await sendAdminCourseExpiryDigest({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        rows: rows.map((r) => ({
          crewName: typeof r.crewName === "string" ? r.crewName : "",
          crewRun: typeof r.crewRun === "string" ? r.crewRun : "",
          courseName: typeof r.courseName === "string" ? r.courseName : "",
          expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
          kind: typeof r.kind === "string" ? r.kind : "expiring",
        })),
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "boarding_book_expiring": {
      const result = await sendBoardingBookExpiringSoonEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        crewName: String(payload.crewName ?? ""),
        validUntil:
          typeof payload.validUntil === "string" ? payload.validUntil : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "boarding_book_admin_digest": {
      const rows = Array.isArray(payload.rows)
        ? (payload.rows as Array<Record<string, unknown>>)
        : [];
      const result = await sendAdminBoardingBookExpiryDigest({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        rows: rows.map((r) => ({
          crewName: typeof r.crewName === "string" ? r.crewName : "",
          crewRun: typeof r.crewRun === "string" ? r.crewRun : "",
          validUntil: typeof r.validUntil === "string" ? r.validUntil : null,
        })),
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "training_expiring": {
      const result = await sendTrainingExpiringSoonEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        crewName: String(payload.crewName ?? ""),
        trainingName: String(payload.trainingName ?? ""),
        expiresAt:
          typeof payload.expiresAt === "string" ? payload.expiresAt : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "training_expired": {
      const result = await sendTrainingExpiredEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        crewName: String(payload.crewName ?? ""),
        trainingName: String(payload.trainingName ?? ""),
        expiresAt:
          typeof payload.expiresAt === "string" ? payload.expiresAt : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "training_admin_digest": {
      const rows = Array.isArray(payload.rows)
        ? (payload.rows as Array<Record<string, unknown>>)
        : [];
      const result = await sendAdminTrainingExpiryDigest({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        rows: rows.map((r) => ({
          crewName: typeof r.crewName === "string" ? r.crewName : "",
          crewRun: typeof r.crewRun === "string" ? r.crewRun : "",
          trainingName:
            typeof r.trainingName === "string" ? r.trainingName : "",
          expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
          kind: typeof r.kind === "string" ? r.kind : "expiring",
        })),
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "work_notice_created": {
      const result = await sendWorkNoticeCreatedEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        code: String(payload.code ?? ""),
        organizationName: String(payload.organizationName ?? ""),
        locationName: String(payload.locationName ?? ""),
        permitTypeName: String(payload.permitTypeName ?? ""),
        tentativeDate:
          typeof payload.tentativeDate === "string"
            ? payload.tentativeDate
            : null,
        requestingAreaName: String(payload.requestingAreaName ?? ""),
        description:
          typeof payload.description === "string" ? payload.description : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    case "work_permit_created": {
      const result = await sendWorkPermitCreatedEmail({
        to: recipient.to,
        logicalTo: recipient.logicalTo,
        overridden: recipient.overridden,
        code: String(payload.code ?? ""),
        organizationName: String(payload.organizationName ?? ""),
        locationName: String(payload.locationName ?? ""),
        permitTypeName: String(payload.permitTypeName ?? ""),
        scheduledDate:
          typeof payload.scheduledDate === "string"
            ? payload.scheduledDate
            : null,
        workNoticeCode:
          typeof payload.workNoticeCode === "string"
            ? payload.workNoticeCode
            : null,
        description:
          typeof payload.description === "string" ? payload.description : null,
      });
      return { resendId: result.resendId, deliveredTo: recipient.to };
    }
    default:
      throw new Error(`Unsupported outbox type: ${row.type}`);
  }
}

/**
 * Procesa hasta maxBatch filas pending.
 * Con NOTIFICATION_EMAIL_OVERRIDE todos los envíos van al correo de prueba.
 */
export async function processOutbox(options?: {
  now?: Date;
  /** Tope de esta corrida (1–50). Default 50. */
  maxBatch?: number;
}): Promise<ProcessOutboxResult> {
  const now = options?.now ?? new Date();
  const maxBatch = Math.min(
    Math.max(options?.maxBatch ?? DEFAULT_MAX_BATCH, 1),
    DEFAULT_MAX_BATCH,
  );
  const recovered = await recoverStaleProcessing({ now });
  if (recovered > 0) {
    console.info("Outbox: filas processing rescatadas", { recovered });
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (let i = 0; i < maxBatch; i += 1) {
    const row = await claimNextPending({ now });
    if (!row) break;

    const stillValid = await validateOutboxRow(row);
    if (!stillValid) {
      await markCancelled(row.id);
      cancelled += 1;
      continue;
    }

    try {
      const { resendId, deliveredTo } = await dispatchOutboxEmail(row);
      await markSent(row.id, { now, resendId, deliveredTo });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(row.id, message, { now });
      failed += 1;
      console.error("Outbox: fallo al enviar", {
        outboxId: row.id,
        type: row.type,
        to: row.to,
        error: message,
      });
    }
  }

  if (sent || failed || cancelled || recovered) {
    console.info("Outbox: corrida terminada", {
      recovered,
      sent,
      failed,
      cancelled,
    });
  }

  return { recovered, sent, failed, cancelled };
}
