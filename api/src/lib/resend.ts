import { Resend } from "resend";
import { AppError } from "./errors.js";

/** Remitente por defecto si EMAIL_FROM no está definido (solo stub/local). */
const DEFAULT_FROM = "Portal Nachipa Wellboats <onboarding@resend.dev>";

/** Cliente Resend lazy: null si no hay API key (modo stub). */
let client: Resend | null | undefined;

/** True cuando hay RESEND_API_KEY y se puede enviar de verdad. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Remitente visible en el correo (dominio de prueba de Resend en local). */
export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/** Instancia única de Resend; null si no hay key. */
function getResendClient(): Resend | null {
  if (client !== undefined) {
    return client;
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  client = apiKey ? new Resend(apiKey) : null;
  return client;
}

/** Adjunto opcional (logo inline vía contentId → cid: en el HTML). */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentId?: string;
};

/** Parámetros mínimos de un envío transaccional. */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

/**
 * Envía un correo vía Resend.
 * Si no hay API key, no llama a la red (el caller hace stub).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    throw new AppError(
      500,
      "email_not_configured",
      "RESEND_API_KEY no configurada",
    );
  }

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  if (error) {
    throw new AppError(
      502,
      "email_send_failed",
      error.message || "No se pudo enviar el correo",
    );
  }
}
