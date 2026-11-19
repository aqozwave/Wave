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

/** Adjunto opcional (logo/foto inline vía contentId → cid: en el HTML). */
export type EmailAttachment = {
  filename: string;
  /** Buffer o base64; se normaliza a base64 antes de llamar a Resend. */
  content?: Buffer | string;
  /** Ruta absoluta local (alternativa a content; Resend la sube). */
  path?: string;
  contentId?: string;
  contentType?: string;
};

/** Parámetros mínimos de un envío transaccional. */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

/** Resultado de un envío real (id de Resend para trazabilidad). */
export type SendEmailResult = {
  /** Id del mensaje en Resend (dashboard / webhooks). */
  resendId: string | null;
};

/** MIME a partir del nombre de archivo. */
function contentTypeFromFilename(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return undefined;
}

/**
 * Resend espera content en base64 (string) para JSON estable.
 * Los Buffer grandes (foto wellboat) a veces fallan como cid si van crudos.
 */
function normalizeAttachments(
  attachments: EmailAttachment[] | undefined,
): EmailAttachment[] | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((att) => {
    const contentType =
      att.contentType ?? contentTypeFromFilename(att.filename);
    if (att.path && att.content == null) {
      return {
        filename: att.filename,
        path: att.path,
        contentId: att.contentId,
        contentType,
      };
    }
    const raw = att.content;
    const content =
      raw instanceof Buffer
        ? raw.toString("base64")
        : typeof raw === "string"
          ? raw
          : undefined;
    return {
      filename: att.filename,
      content,
      contentId: att.contentId,
      contentType,
    };
  });
}

/**
 * Envía un correo vía Resend.
 * Si no hay API key, no llama a la red (el caller hace stub).
 * Devuelve resendId para guardar en outbox / logs.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    throw new AppError(
      500,
      "email_not_configured",
      "RESEND_API_KEY no configurada",
    );
  }

  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: normalizeAttachments(input.attachments),
  });

  if (error) {
    throw new AppError(
      502,
      "email_send_failed",
      error.message || "No se pudo enviar el correo",
    );
  }

  return { resendId: data?.id ?? null };
}
