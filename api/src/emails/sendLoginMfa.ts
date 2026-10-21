import { createElement } from "react";
import { render } from "@react-email/render";
import { isEmailConfigured, sendEmail } from "../lib/resend.js";
import { getLogoAttachment } from "./emailBrand.js";
import { LoginMfa } from "./LoginMfa.js";

/** Minutos de validez del código MFA. */
const MFA_EXPIRES_MINUTES = Number(
  process.env.LOGIN_MFA_CODE_EXPIRES_MINUTES ?? 10,
);

/** Asunto del correo MFA. */
const SUBJECT = "Código de verificación — Portal Nachipa Wellboats";

/** Datos para enviar (o stubbear) el código MFA. */
export type SendLoginMfaInput = {
  to: string;
  firstName: string;
  code: string;
};

/**
 * Envía el código de 6 dígitos.
 * Sin API key: loguea el código (Bruno / dev).
 */
export async function sendLoginMfaEmail(
  input: SendLoginMfaInput,
): Promise<void> {
  const expiresLabel =
    MFA_EXPIRES_MINUTES === 1 ? "1 minuto" : `${MFA_EXPIRES_MINUTES} minutos`;

  if (!isEmailConfigured()) {
    console.info(
      `[email.stub] MFA para ${input.to}: code=${input.code} (expira en ${expiresLabel})`,
    );
    return;
  }

  const html = await render(
    createElement(LoginMfa, {
      firstName: input.firstName,
      code: input.code,
      expiresLabel,
    }),
  );

  await sendEmail({
    to: input.to,
    subject: SUBJECT,
    html,
    attachments: [getLogoAttachment()],
  });
}
