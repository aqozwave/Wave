import { createElement } from "react";
import { render } from "@react-email/render";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { getLogoAttachment } from "./emailBrand.js";
import { ResetPassword } from "./ResetPassword.js";

/** Base del front para el enlace del correo. */
const WEB_APP_URL = (
  process.env.WEB_APP_URL ?? "http://localhost:5173"
).replace(/\/$/, "");

/** Minutos de validez del reset (misma env que emailToken). */
const RESET_EXPIRES_MINUTES = Number(
  process.env.EMAIL_RESET_EXPIRES_MINUTES ?? 60,
);

/** Asunto del correo de reset. */
const SUBJECT = "Restablecé tu contraseña — Portal Nachipa Wellboats";

/** URL de la pantalla web de reset (UI después). */
export function buildResetPasswordUrl(plainToken: string): string {
  const q = new URLSearchParams({ token: plainToken });
  return `${WEB_APP_URL}/reset-password?${q.toString()}`;
}

/** Etiqueta humana de caducidad. */
function expiresLabel(): string {
  if (RESET_EXPIRES_MINUTES >= 60) {
    const hours = Math.round(RESET_EXPIRES_MINUTES / 60);
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return `${RESET_EXPIRES_MINUTES} minutos`;
}

/** Datos para enviar (o stubbear) el correo de reset. */
export type SendResetPasswordInput = {
  to: string;
  firstName: string;
  plainToken: string;
  expiresAt: Date;
};

/**
 * Renderiza la plantilla y envía con Resend.
 * Sin API key: deja el token en el log (Bruno / dev).
 */
export async function sendResetPasswordEmail(
  input: SendResetPasswordInput,
): Promise<void> {
  const resetUrl = buildResetPasswordUrl(input.plainToken);

  if (!isEmailConfigured()) {
    console.info(
      `[email.stub] reset para ${input.to}: token=${input.plainToken} url=${resetUrl} (expira ${input.expiresAt.toISOString()})`,
    );
    return;
  }

  const html = await render(
    createElement(ResetPassword, {
      firstName: input.firstName,
      resetUrl,
      expiresLabel: expiresLabel(),
    }),
  );

  await sendEmail({
    to: input.to,
    subject: SUBJECT,
    html,
    attachments: [getLogoAttachment()],
  });
}
