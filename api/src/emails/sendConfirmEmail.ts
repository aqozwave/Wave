import { createElement } from "react";
import { render } from "@react-email/render";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { ConfirmEmail } from "./ConfirmEmail.js";

/** Base del front para armar el enlace del correo. */
const WEB_APP_URL = (
  process.env.WEB_APP_URL ?? "http://localhost:5173"
).replace(/\/$/, "");

/** Minutos de validez (misma env que emailToken). */
const CONFIRM_EXPIRES_MINUTES = Number(
  process.env.EMAIL_CONFIRM_EXPIRES_MINUTES ?? 1440,
);

/** Asunto fijo del correo de confirmación. */
const SUBJECT = "Confirmá tu cuenta — Portal Nachipa Wellboats";

/**
 * URL que recibe el usuario: pantalla web (luego) con ?token=.
 * Hasta existir la UI, Bruno puede usar el token del stub o del mail.
 */
export function buildConfirmEmailUrl(plainToken: string): string {
  const q = new URLSearchParams({ token: plainToken });
  return `${WEB_APP_URL}/confirm-email?${q.toString()}`;
}

/** Etiqueta humana de caducidad para el cuerpo del mail. */
function expiresLabel(): string {
  if (CONFIRM_EXPIRES_MINUTES >= 1440) {
    const days = Math.round(CONFIRM_EXPIRES_MINUTES / 1440);
    return days === 1 ? "24 horas" : `${days} días`;
  }
  if (CONFIRM_EXPIRES_MINUTES >= 60) {
    const hours = Math.round(CONFIRM_EXPIRES_MINUTES / 60);
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return `${CONFIRM_EXPIRES_MINUTES} minutos`;
}

/** Datos para enviar (o stubbear) el correo de confirmación. */
export type SendConfirmEmailInput = {
  to: string;
  firstName: string;
  plainToken: string;
  expiresAt: Date;
};

/**
 * Renderiza la plantilla y envía con Resend.
 * Sin API key: deja el token en el log (Bruno / dev local).
 */
export async function sendConfirmEmail(
  input: SendConfirmEmailInput,
): Promise<void> {
  const confirmUrl = buildConfirmEmailUrl(input.plainToken);

  if (!isEmailConfigured()) {
    console.info(
      `[email.stub] confirm para ${input.to}: token=${input.plainToken} url=${confirmUrl} (expira ${input.expiresAt.toISOString()})`,
    );
    return;
  }

  // createElement evita el bug de React 19 al pasar el resultado de llamar el componente a mano.
  const html = await render(
    createElement(ConfirmEmail, {
      firstName: input.firstName,
      confirmUrl,
      expiresLabel: expiresLabel(),
    }),
  );

  await sendEmail({
    to: input.to,
    subject: SUBJECT,
    html,
  });
}
