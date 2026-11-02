import { createElement } from "react";
import { render } from "@react-email/render";
import { daysUntilExpiry } from "../lib/crewCourseStatus.js";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { BoardingBookAdminDigest } from "./BoardingBookAdminDigest.js";
import { BoardingBookExpiring } from "./BoardingBookExpiring.js";
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

/** Envía (o stubbea) un mail de notificación de libreta. */
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

/** Libreta por vencer → tripulante. */
export async function sendBoardingBookExpiringSoonEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  crewName: string;
  validUntil: Date | string | null;
}): Promise<NotificationSendResult> {
  const displayName = formatDisplayName(input.crewName);
  const validUntilLabel = formatLongDate(input.validUntil);
  const daysLeft =
    daysUntilExpiry(
      input.validUntil ? new Date(input.validUntil) : null,
    ) ?? 0;

  const html = await render(
    createElement(BoardingBookExpiring, {
      crewName: displayName,
      validUntilLabel,
      daysLeft,
    }),
  );

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Tu libreta de embarque está por vencer",
    html,
  });
}

/** Digest diario de libretas → admin. */
export async function sendAdminBoardingBookExpiryDigest(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  rows: Array<{
    crewName?: string;
    crewRun?: string;
    validUntil?: string | null;
  }>;
}): Promise<NotificationSendResult> {
  const rows = input.rows.map((row) => ({
    crewName: formatDisplayName(String(row.crewName ?? "")),
    crewRun: String(row.crewRun ?? "").trim() || "—",
    validUntilLabel: formatShortDate(row.validUntil ?? null),
  }));

  const html = await render(createElement(BoardingBookAdminDigest, { rows }));

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Libretas de embarque por vencer — resumen tripulantes",
    html,
  });
}
