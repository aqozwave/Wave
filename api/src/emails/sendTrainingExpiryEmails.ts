import { createElement } from "react";
import { render } from "@react-email/render";
import { daysUntilExpiry } from "../lib/crewCourseStatus.js";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { getLogoAttachment } from "./emailBrand.js";
import { TrainingAdminDigest } from "./TrainingAdminDigest.js";
import { TrainingExpired } from "./TrainingExpired.js";
import { TrainingExpiring } from "./TrainingExpiring.js";

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

/** Prefijo de asunto cuando hay override de prueba. */
function subjectWithOverride(
  subject: string,
  logicalTo: string,
  overridden: boolean,
): string {
  if (!overridden) return subject;
  return `[Prueba → ${logicalTo}] ${subject}`;
}

/** Resultado de un envío de notificación. */
export type NotificationSendResult = {
  resendId: string | null;
  stub: boolean;
};

/** Envía o stubbea el mail. */
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

/** Capacitación por vencer → tripulante. */
export async function sendTrainingExpiringSoonEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  crewName: string;
  trainingName: string;
  expiresAt: Date | string | null;
}): Promise<NotificationSendResult> {
  const displayName = formatDisplayName(input.crewName);
  const expiresLabel = formatLongDate(input.expiresAt);
  const daysLeft =
    daysUntilExpiry(
      input.expiresAt ? new Date(input.expiresAt) : null,
    ) ?? 0;

  const html = await render(
    createElement(TrainingExpiring, {
      crewName: displayName,
      trainingName: input.trainingName,
      expiresLabel,
      daysLeft,
    }),
  );

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Tu capacitación está por vencer",
    html,
  });
}

/** Capacitación vencida → tripulante. */
export async function sendTrainingExpiredEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  crewName: string;
  trainingName: string;
  expiresAt: Date | string | null;
}): Promise<NotificationSendResult> {
  const displayName = formatDisplayName(input.crewName);
  const expiresLabel = formatLongDate(input.expiresAt);

  const html = await render(
    createElement(TrainingExpired, {
      crewName: displayName,
      trainingName: input.trainingName,
      expiresLabel,
    }),
  );

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: "Tu capacitación venció",
    html,
  });
}

/** Digest diario → admin / prevencionista. */
export async function sendAdminTrainingExpiryDigest(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  rows: Array<{
    crewName?: string;
    crewRun?: string;
    trainingName?: string;
    expiresAt?: string | null;
    kind?: string;
  }>;
}): Promise<NotificationSendResult> {
  const rows = input.rows.map((row) => ({
    crewName: formatDisplayName(String(row.crewName ?? "")),
    crewRun: String(row.crewRun ?? "").trim() || "—",
    trainingName: String(row.trainingName ?? "—"),
    expiresLabel: formatShortDate(row.expiresAt ?? null),
    estado: row.kind === "expired" ? "Vencido" : "Por vencer",
  }));

  const html = await render(createElement(TrainingAdminDigest, { rows }));

  return deliverNotification({
    to: input.to,
    logicalTo: input.logicalTo,
    overridden: input.overridden,
    subject: `Capacitaciones — ${rows.length} vigencia${rows.length === 1 ? "" : "s"}`,
    html,
  });
}
