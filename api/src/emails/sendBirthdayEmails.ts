import { createElement } from "react";
import { render } from "@react-email/render";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { BirthdayAdmin } from "./BirthdayAdmin.js";
import { BirthdayPerson } from "./BirthdayPerson.js";
import {
  getBirthdayPersonAttachments,
  getLogoAttachment,
} from "./emailBrand.js";

/** Prefijo de asunto cuando NOTIFICATION_EMAIL_OVERRIDE redirige el envío. */
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

/** Etiqueta humana del tipo de persona. */
function personKindLabel(kind: string): string {
  if (kind === "crew") return "Embarcado / tripulante";
  if (kind === "user") return "Usuario del sistema";
  return "Persona";
}

/**
 * Mail a admin/RR.HH.: cumpleaños de un usuario o embarcado de su empresa.
 */
export async function sendBirthdayAdminEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  personName: string;
  personRun: string;
  personKind: string;
}): Promise<NotificationSendResult> {
  const kindLabel = personKindLabel(input.personKind);
  const html = await render(
    createElement(BirthdayAdmin, {
      personName: input.personName.trim() || "—",
      personRun: input.personRun.trim() || "—",
      personKindLabel: kindLabel,
    }),
  );

  const subject = subjectWithOverride(
    `Cumpleaños: ${input.personName.trim() || "persona"}`,
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

/**
 * Mail de felicitaciones al cumpleañero (usuario o embarcado).
 * Asunto con el saludo; el cuerpo muestra el nombre (sin repetir el mismo texto).
 */
export async function sendBirthdayPersonEmail(input: {
  to: string;
  logicalTo: string;
  overridden: boolean;
  /** Nombre completo para el cuerpo. */
  personName: string;
  /** Fallback si solo viene el nombre de pila. */
  firstName?: string;
}): Promise<NotificationSendResult> {
  const personName =
    input.personName.trim() ||
    input.firstName?.trim() ||
    "Equipo Nachipa";
  const html = await render(
    createElement(BirthdayPerson, { personName }),
  );

  // Mismo criterio que el portal viejo: saludo solo en el asunto.
  const subject = subjectWithOverride(
    "[No responder] 🎉 ¡Feliz cumpleaños!",
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
    // Logo + foto wellboat embebidos (cid); no hotlink externo.
    attachments: getBirthdayPersonAttachments(),
  });
  return { resendId, stub: false };
}
