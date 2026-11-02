import { createElement } from "react";
import { render } from "@react-email/render";
import { daysUntilExpiry } from "../lib/crewCourseStatus.js";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { CourseAdminDigest } from "./CourseAdminDigest.js";
import { CourseExpired } from "./CourseExpired.js";
import { CourseExpiring } from "./CourseExpiring.js";
import { getLogoAttachment } from "./emailBrand.js";

/** Formato largo es-CL para el cuerpo del mail. */
function formatLongDate(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Formato corto para filas del digest. */
function formatShortDate(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Capitaliza nombre para el saludo. */
function formatDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "tripulante";
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Prefijo de asunto cuando NOTIFICATION_EMAIL_OVERRIDE redirige el envío.
 * Deja visible el destinatario lógico en Resend / bandeja de prueba.
 */
function subjectWithOverride(
  subject: string,
  logicalTo: string,
  overridden: boolean,
): string {
  if (!overridden) return subject;
  return `[Prueba → ${logicalTo}] ${subject}`;
}

/** Resultado de un envío de notificación (id Resend o stub). */
export type NotificationSendResult = {
  resendId: string | null;
  stub: boolean;
};

/**
 * Envía (o stubbea) un mail de vencimiento al destino efectivo.
 * El caller ya resolvió override; `logicalTo` solo va al subject/log.
 */
async function deliverNotification(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  subject: string;
  html: string;
}): Promise<NotificationSendResult> {
  const subject = subjectWithOverride(
    input.subject,
    input.logicalTo,
    input.overridden,
  );

  if (!isEmailConfigured()) {
    console.info(
      `[email.stub] notification to=${input.to} logical=${input.logicalTo} subject=${subject}`,
    );
    return { resendId: null, stub: true };
  }

  const { resendId } = await sendEmail({
    to: input.to,
    subject,
    html: input.html,
    attachments: [getLogoAttachment()],
  });
  return { resendId, stub: false };
}

/** Curso por vencer → tripulante. */
export async function sendCourseExpiringSoonEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  crewName: string;
  courseName: string;
  expiresAt: Date | string | null;
}): Promise<NotificationSendResult> {
  const displayName = formatDisplayName(input.crewName);
  const expiresLabel = formatLongDate(input.expiresAt);
  const daysLeft =
    daysUntilExpiry(
      input.expiresAt ? new Date(input.expiresAt) : null,
    ) ?? 0;

  const html = await render(
    createElement(CourseExpiring, {
      crewName: displayName,
      courseName: input.courseName,
      expiresLabel,
      daysLeft,
    }),
  );

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Tu curso está por vencer",
    html,
  });
}

/** Curso vencido → tripulante. */
export async function sendCourseExpiredEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  crewName: string;
  courseName: string;
  expiresAt: Date | string | null;
}): Promise<NotificationSendResult> {
  const displayName = formatDisplayName(input.crewName);
  const expiresLabel = formatLongDate(input.expiresAt);

  const html = await render(
    createElement(CourseExpired, {
      crewName: displayName,
      courseName: input.courseName,
      expiresLabel,
    }),
  );

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Tu curso venció",
    html,
  });
}

/** Digest diario → admin. */
export async function sendAdminCourseExpiryDigest(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  rows: Array<{
    crewName?: string;
    crewRun?: string;
    courseName?: string;
    expiresAt?: string | null;
    kind?: string;
  }>;
}): Promise<NotificationSendResult> {
  const rows = input.rows.map((row) => ({
    crewName: formatDisplayName(String(row.crewName ?? "")),
    crewRun: String(row.crewRun ?? "").trim() || "—",
    courseName: String(row.courseName ?? "—"),
    expiresLabel: formatShortDate(row.expiresAt ?? null),
    estado: row.kind === "expired" ? "Vencido" : "Por vencer",
  }));

  const html = await render(createElement(CourseAdminDigest, { rows }));

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Cursos — resumen de vigencias (por vencer y vencidos)",
    html,
  });
}
