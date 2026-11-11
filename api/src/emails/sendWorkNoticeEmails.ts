import { createElement } from "react";
import { render } from "@react-email/render";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { getLogoAttachment } from "./emailBrand.js";
import { WorkNoticeCreated } from "./WorkNoticeCreated.js";

/** Formato corto de fecha tentativa (día calendario). */
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

/** Prefijo de asunto cuando hay override de prueba. */
function subjectWithOverride(
  subject: string,
  logicalTo: string,
  overridden: boolean,
): string {
  if (!overridden) return subject;
  return `[Prueba → ${logicalTo}] ${subject}`;
}

/** Resultado de un envío. */
export type NotificationSendResult = {
  resendId: string | null;
  stub: boolean;
};

/**
 * Mail a Prevención/admin: nuevo aviso de trabajo.
 */
export async function sendWorkNoticeCreatedEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  code: string;
  organizationName: string;
  locationName: string;
  permitTypeName: string;
  tentativeDate: Date | string | null;
  requestingAreaName: string;
  description: string | null;
}): Promise<NotificationSendResult> {
  const tentativeDateLabel = formatShortDate(input.tentativeDate);
  const html = await render(
    createElement(WorkNoticeCreated, {
      code: input.code,
      organizationName: input.organizationName,
      locationName: input.locationName,
      permitTypeName: input.permitTypeName,
      tentativeDateLabel,
      requestingAreaName: input.requestingAreaName,
      description: input.description,
    }),
  );

  const subject = subjectWithOverride(
    `Nuevo aviso de trabajo ${input.code}`,
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
    html,
    attachments: [getLogoAttachment()],
  });
  return { resendId, stub: false };
}
